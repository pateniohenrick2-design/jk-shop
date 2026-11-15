'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { screenshotHref } from '@/lib/accountValue';
import { SUPPLIER_SITES, canProcessOnSupplier, supplierLink } from '@/lib/supplierSites';
import { splitProofs } from '@/lib/proofs';
import {
  GENERAL_OPTIONS, GIFTING_OPTIONS, isGiftingCategory, statusBadgeClass, statusLabel, type OrderStatusValue,
} from '@/lib/orderStatus';

const POLL_MS = 10000; // how often the page checks for changes (e.g. status edits in the Google Sheet)

type FieldValue = { label: string; value: string };
type Note = { id: string; text: string; admin: string; createdAt: string };
type OrderRow = {
  id: string;
  orderCode: string | null;
  gameId: string;
  gameName: string;
  categoryName: string;
  itemName: string | null;
  eventName: string | null;
  accountFields: FieldValue[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethodName: string;
  proofOfPaymentUrl: string | null;
  facebookName: string | null;
  email: string | null;
 status: OrderStatusValue;
  createdAt: string;
  notes: Note[];
};

function shortId(id: string) {
  return 'JK' + id.slice(-6).toUpperCase();
}

export default function OrdersClient({
  initialOrders,
  games,
  loadedAt,
  total,
  page,
  pageSize,
  filters,
}: {
  initialOrders: OrderRow[];
  games: { id: string; name: string }[];
  loadedAt: string;
  total: number;
  page: number;
  pageSize: number;
  filters: { q: string; game: string; status: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  // Filters + page live in the URL; the server loads just that page
  function go(next: Partial<{ q: string; game: string; status: string; page: number }>) {
    const merged = { ...filters, page, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set('q', merged.q);
    if (merged.game && merged.game !== 'all') params.set('game', merged.game);
    if (merged.status && merged.status !== 'all') params.set('status', merged.status);
    if (merged.page > 1) params.set('page', String(merged.page));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }
  const [orders, setOrders] = useState(initialOrders);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const sinceRef = useRef(loadedAt);

  // A full reload from the server (new orders) replaces the list
  useEffect(() => { setOrders(initialOrders); sinceRef.current = loadedAt; }, [initialOrders, loadedAt]);

  // Live updates: every few seconds (only while the tab is visible) ask what changed since the last check.
  // Status changes are merged in place; new orders reload the list from the server.
  useEffect(() => {
    let stopped = false;
    let busy = false;
    async function check() {
      if (busy || stopped || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const res = await fetch(`/api/admin/order-updates?since=${encodeURIComponent(sinceRef.current)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body: { now: string; changed: { id: string; status: OrderRow['status'] }[]; newOrders: number } = await res.json();
        sinceRef.current = body.now;
        setLastSync(new Date());
        if (body.changed.length) {
          const map = new Map(body.changed.map((c) => [c.id, c.status]));
          setOrders((prev) => {
            let diff = false;
            const next = prev.map((o) => {
              const s = map.get(o.id);
              if (s && s !== o.status) { diff = true; return { ...o, status: s }; }
              return o;
            });
            return diff ? next : prev;
          });
        }
        // New orders show up on page 1 (newest first); other pages stay put while you work
        if (body.newOrders > 0 && page === 1) router.refresh();
      } catch {
        // offline for a moment: try again on the next tick
      } finally {
        busy = false;
      }
    }
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [router, page]);
  const [query, setQuery] = useState(filters.q);
  useEffect(() => { setQuery(filters.q); }, [filters.q]);
  // Search as you type (after a short pause), starting again from page 1
  useEffect(() => {
    if (query.trim() === filters.q) return;
    const t = setTimeout(() => go({ q: query.trim(), page: 1 }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  // Selection is per page
  useEffect(() => { setSelected(new Set()); setExpandedId(null); }, [initialOrders]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [proofList, setProofList] = useState<string[]>([]); // all proof images of the open order
  const [processing, setProcessing] = useState<OrderRow | null>(null); // PROCESS dialog
  const [processMsg, setProcessMsg] = useState<string | null>(null);

  const filtered = orders; // already searched/filtered by the server (one page)

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((o) => o.id)));
    }
  }

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: status as OrderRow['status'] } : o)));
    } catch {
      alert('Failed to update status. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  // PROCESS (same as the sheet's button): open the top-up site with the order pre-filled
  // (Tampermonkey fills it in), set the order to In Progress and tell the sheet which site was used.
  function accountValue(o: OrderRow, re: RegExp) {
    return o.accountFields.find((f) => re.test(f.label))?.value ?? '';
  }
  async function markProcessing(o: OrderRow, site: string) {
    setProcessMsg(`Opening ${site}…`);
    try {
      const res = await fetch(`/api/orders/${o.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress', supplier: site }),
      });
      if (!res.ok) throw new Error();
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: 'in_progress' } : x)));
      setProcessing(null);
      setProcessMsg(null);
    } catch {
      setProcessMsg(`${site} opened, but the status could not be updated. Set it to In Progress by hand.`);
    }
  }

  async function bulkUpdate(status: string) {
    if (selected.size === 0) return;
    const orderIds = Array.from(selected);
    try {
      const res = await fetch('/api/orders/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds, status }),
      });
      if (!res.ok) throw new Error();
      setOrders((prev) =>
        prev.map((o) => (orderIds.includes(o.id) ? { ...o, status: status as OrderRow['status'] } : o))
      );
      setSelected(new Set());
    } catch {
      alert('Bulk update failed. Please try again.');
    }
  }

  async function viewProof(id: string) {
    try {
      const res = await fetch(`/api/orders/${id}/proof-url`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProofList(Array.isArray(data.urls) && data.urls.length ? data.urls : [data.url]);
      setProofModalUrl(data.url);
    } catch {
      alert('Could not load proof of payment.');
    }
  }

  async function addNote(id: string) {
    const text = (noteDrafts[id] ?? '').trim();
    if (!text) return;
    try {
      const res = await fetch(`/api/orders/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText: text }),
      });
      if (!res.ok) throw new Error();
      const note = await res.json();
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, notes: [{ id: note.id, text: note.noteText, admin: note.admin.username, createdAt: note.createdAt }, ...o.notes] }
            : o
        )
      );
      setNoteDrafts((prev) => ({ ...prev, [id]: '' }));
    } catch {
      alert('Failed to add note. Please try again.');
    }
  }

  function exportCSV() {
    // Downloads EVERY order matching the current search/filters, not just this page
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.game !== 'all') params.set('game', filters.game);
    if (filters.status !== 'all') params.set('status', filters.status);
    window.location.href = `/api/admin/orders/export?${params.toString()}`;
  }

  return (
    <div>
      <h1 className="admin-page-title">Orders</h1>
      <p className="field-hint">
        All games, filterable — update status, bulk actions, export.{' '}
        <span className="orders-live" title="Checks for changes (e.g. from the Google Sheet) every 10 seconds">
          <span className="orders-live-dot" /> Live{lastSync ? ` · checked ${lastSync.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}` : ''}
        </span>
      </p>

      <div className="panel">
        <div className="orders-toolbar">
          <input
            className="field-input orders-search"
            placeholder="Search Order ID / IGN / User ID / Email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="others-sel orders-filter-sel" value={filters.game} onChange={(e) => go({ game: e.target.value, page: 1 })}>
            <option value="all">All Games</option>
            {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="others-sel orders-filter-sel" value={filters.status} onChange={(e) => go({ status: e.target.value, page: 1 })}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="reserved">Reserved (gifting)</option>
            <option value="friends">Friends (gifting)</option>
            <option value="successful">Successful / Delivered</option>
            <option value="refund">Refund</option>
            <option value="failed">Failed</option>
          </select>
          <button className="qty-btn orders-bulk-btn" onClick={exportCSV} title="Downloads every order matching the search and filters">Export CSV ({total})</button>
        </div>

        <table className="admin-table orders-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleSelectAll} /></th>
              <th>Order</th>
              <th>Game</th>
              <th>Item / Category</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="field-hint">No matching orders.</td></tr>
            )}
            {filtered.map((o) => {
              const isExpanded = expandedId === o.id;
              const primaryField = o.accountFields[0]?.value || '—';
              const hasRush = o.notes.some((n) => /rush/i.test(n.text));
              const gifting = isGiftingCategory(o.categoryName);
              const options = gifting ? GIFTING_OPTIONS : GENERAL_OPTIONS;
              return (
                <>
                  <tr key={o.id} className="orders-row">
                    <td className="oc-check"><input type="checkbox" aria-label={`Select ${o.orderCode ?? o.id}`} checked={selected.has(o.id)} onChange={() => toggleSelected(o.id)} /></td>
                    <td className="oc-code" data-label="Order">{(o.orderCode ?? shortId(o.id))}</td>
                    <td className="oc-game" data-label="Game">{o.gameName}</td>
                    <td className="oc-item" data-label="Item">{o.itemName ?? o.eventName ?? o.categoryName}</td>
                    <td className="oc-cust" data-label="Customer">{primaryField}</td>
                    <td className="oc-amount" data-label="Amount">₱{o.totalPrice}</td>
                    <td className="oc-status" data-label="Status">
                      <span className={statusBadgeClass(o.status)}>
                        {statusLabel(o.status, gifting)}
                      </span>
                      {hasRush && <span className="badge badge-rush">RUSH</span>}
                    </td>
                    <td className="oc-date" data-label="Date">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="oc-actions">
                      <select
                        className="others-sel orders-status-sel"
                        value={o.status}
                        disabled={busyId === o.id}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                      >
                        {/* Keep the current status selectable even if it isn't one of this order type's usual choices */}
                        {(options.includes(o.status) ? options : [o.status, ...options]).map((s) => (
                          <option key={s} value={s}>{statusLabel(s, gifting)}</option>
                        ))}
                      </select>
                      {/* Only orders still waiting to be topped up */}
                      {canProcessOnSupplier(o) && (o.status === 'pending' || o.status === 'in_progress') && (
                        <button className="qty-btn orders-process-btn" title="Open a top-up site with this order filled in" onClick={() => { setProcessMsg(null); setProcessing(o); }}>
                          Process
                        </button>
                      )}
                      <button className="qty-btn orders-expand-btn" onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${o.id}-expand`} className="orders-expand-row">
                      <td colSpan={9}>
                        <div className="order-expand">
                          <div className="order-expand-col">
                            <h4 className="order-expand-head">
                              Account Details
                              {/* One tap copies every detail (User ID, Server ID, IGN…), one per line */}
                              {o.accountFields.some((f) => f.value && !screenshotHref(f.value)) && (
                                <CopyButton
                                  label="all account details"
                                  text="Copy"
                                  value={o.accountFields
                                    .filter((f) => f.value && !screenshotHref(f.value))
                                    .map((f) => `${f.label.replace(/^Enter\s+/i, '')}: ${f.value}`)
                                    .join('\n')}
                                />
                              )}
                            </h4>
                            {o.accountFields.map((f, i) => (
                              <p key={i} className="order-expand-line"><strong>{f.label.replace(/^Enter\s+/i, '')}:</strong>{' '}
                                {screenshotHref(f.value)
                                  ? <a href={screenshotHref(f.value)!} target="_blank" rel="noopener noreferrer" className="login-link">View screenshot ↗</a>
                                  : (f.value || '—')}
                              </p>
                            ))}
                            <p className="order-expand-line"><strong>Payment:</strong> {o.paymentMethodName}</p>
                            <p className="order-expand-line"><strong>Facebook:</strong> {o.facebookName || '—'}</p>
                            <p className="order-expand-line"><strong>Email:</strong> {o.email || '—'}</p>
                            {o.proofOfPaymentUrl && (
                              <button className="qty-btn orders-expand-btn orders-proof-btn" onClick={() => viewProof(o.id)}>
                                View Proof of Payment{splitProofs(o.proofOfPaymentUrl).length > 1 ? ` (${splitProofs(o.proofOfPaymentUrl).length})` : ''}
                              </button>
                            )}
                          </div>
                          <div className="order-expand-col">
                            <h4>Internal Notes</h4>
                            <div className="notes-list">
                              {o.notes.length === 0 && <p className="field-hint">No notes yet.</p>}
                              {o.notes.map((n) => (
                                <div key={n.id} className="note-item">
                                  <span>{n.text}</span>
                                  <span className="note-meta">{n.admin} · {new Date(n.createdAt).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                            <div className="note-add-row">
                              <input
                                className="field-input"
                                placeholder="Add an internal note..."
                                value={noteDrafts[o.id] ?? ''}
                                onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [o.id]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') addNote(o.id); }}
                              />
                              <button className="note-add-btn" aria-label="Add note" onClick={() => addNote(o.id)}>
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 20L21 12L3 4V10L15 12L3 14V20Z" fill="currentColor" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        <Pager page={page} pages={pages} total={total} pageSize={pageSize} onGo={(p) => { go({ page: p }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      </div>

      {processing && (() => {
        const o = processing;
        const userId = accountValue(o, /user\s*id|^id$/i);
        const serverId = accountValue(o, /server|zone/i);
        const ign = accountValue(o, /ign|in.?game|name/i);
        const item = o.itemName ?? '';
        const missing = !userId || !serverId.replace(/\D/g, '');
        return (
          <div className="qr-modal-overlay" onClick={() => setProcessing(null)}>
            <div className="qr-modal process-modal" role="dialog" aria-modal="true" aria-labelledby="process-title" onClick={(e) => e.stopPropagation()}>
              <h3 id="process-title">Process order</h3>
              <div className="process-info">
                <strong>{o.orderCode ?? shortId(o.id)}</strong>{ign && <> · {ign}</>}<br />
                {userId || '—'} ({serverId || '—'}) — <strong>{item}</strong><br />
                <span className="muted">{o.categoryName} · ₱{o.totalPrice}</span>
              </div>
              {missing ? (
                <p className="error-msg">This order is missing a User ID or Server ID, so it can&apos;t be filled in automatically.</p>
              ) : (
                <>
                  <p className="process-ask">Process on which site?</p>
                  <div className="process-sites">
                    {SUPPLIER_SITES.map((s) => (
                      <a
                        key={s.name}
                        className="process-site-btn"
                        href={supplierLink(s.url, { userId, serverId, item, orderCode: o.orderCode ?? o.id })}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markProcessing(o, s.name)}
                      >
                        {s.name}
                      </a>
                    ))}
                  </div>
                </>
              )}
              {processMsg && <p className="field-hint process-msg">{processMsg}</p>}
              <p className="field-hint" style={{ margin: '10px 0 0' }}>
                The site opens in a new tab and fills in by itself (needs the Tampermonkey script). The order becomes
                <strong> In Progress</strong> and the site name is written to the sheet&apos;s Supplier column.
              </p>
              <button type="button" className="pl-btn" style={{ marginTop: 12 }} onClick={() => setProcessing(null)}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {proofModalUrl && (
        <div className="qr-modal-overlay" onClick={() => setProofModalUrl(null)}>
          <div
            className="qr-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '95vw', height: '95vh', maxWidth: 'none', maxHeight: 'none', display: 'flex', flexDirection: 'column' }}
          >
            <button className="qr-modal-close" onClick={() => setProofModalUrl(null)}>✕</button>
            <h3>
              Proof of Payment
              {proofList.length > 1 && <span className="proof-count"> · {proofList.indexOf(proofModalUrl) + 1} of {proofList.length}</span>}
            </h3>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
              {proofList.length > 1 && (
                <button
                  type="button"
                  className="proof-nav prev"
                  aria-label="Previous image"
                  onClick={() => { const i = proofList.indexOf(proofModalUrl); setProofModalUrl(proofList[(i - 1 + proofList.length) % proofList.length]); }}
                >‹</button>
              )}
              <img
                src={proofModalUrl}
                alt="Proof of payment"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
              {proofList.length > 1 && (
                <button
                  type="button"
                  className="proof-nav next"
                  aria-label="Next image"
                  onClick={() => { const i = proofList.indexOf(proofModalUrl); setProofModalUrl(proofList[(i + 1) % proofList.length]); }}
                >›</button>
              )}
            </div>
            {proofList.length > 1 && (
              <div className="proof-thumbs">
                {proofList.map((u, i) => (
                  <button key={u} type="button" className={`proof-thumb${u === proofModalUrl ? ' active' : ''}`} aria-label={`Image ${i + 1}`} onClick={() => setProofModalUrl(u)}>
                    <img src={u} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// "Showing 11–20 of 134" + Previous · 1 … 4 5 6 … 14 · Next
function Pager({ page, pages, total, pageSize, onGo }: { page: number; pages: number; total: number; pageSize: number; onGo: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nums: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <nav className="orders-pager" aria-label="Orders pages">
      <span className="orders-pager-info">Showing {from}–{to} of {total.toLocaleString('en-PH')}</span>
      <div className="orders-pager-btns">
        <button type="button" className="orders-page-btn" disabled={page <= 1} onClick={() => onGo(page - 1)}>‹ Previous</button>
        {nums.map((n, i) =>
          n === '…' ? <span key={`gap${i}`} className="orders-page-gap">…</span> : (
            <button
              key={n}
              type="button"
              className={`orders-page-btn${n === page ? ' active' : ''}`}
              aria-current={n === page ? 'page' : undefined}
              onClick={() => n !== page && onGo(n)}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" className="orders-page-btn" disabled={page >= pages} onClick={() => onGo(page + 1)}>Next ›</button>
      </div>
    </nav>
  );
}

// Small "Copy" button next to a value (User ID, Server ID, IGN…); shows "Copied" for a moment
function CopyButton({ value, label, text = 'Copy' }: { value: string; label: string; text?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Older browsers / non-https: fall back to a hidden textarea
      const t = document.createElement('textarea');
      t.value = value;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }
  return (
    <button type="button" className={`copy-chip${copied ? ' copied' : ''}`} onClick={copy} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
      {copied ? '✓ Copied' : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          {text}
        </>
      )}
    </button>
  );
}
