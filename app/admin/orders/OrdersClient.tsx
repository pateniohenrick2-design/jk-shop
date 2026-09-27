'use client';

import { useMemo, useState } from 'react';

type FieldValue = { label: string; value: string };
type Note = { id: string; text: string; admin: string; createdAt: string };
type OrderRow = {
  id: string;
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
  status: 'pending' | 'in_progress' | 'done';
  createdAt: string;
  notes: Note[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

function shortId(id: string) {
  return 'JK' + id.slice(-6).toUpperCase();
}

export default function OrdersClient({
  initialOrders,
  games,
}: {
  initialOrders: OrderRow[];
  games: { id: string; name: string }[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [gameFilter, setGameFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (gameFilter !== 'all' && o.gameId !== gameFilter) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        shortId(o.id),
        o.facebookName ?? '',
        o.email ?? '',
        ...o.accountFields.map((f) => f.value),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, gameFilter, statusFilter, query]);

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
    const header = ['Order', 'Game', 'Category', 'Customer Fields', 'Amount', 'Status', 'Date'];
    const rows = filtered.map((o) => [
      shortId(o.id),
      o.gameName,
      o.itemName ?? o.eventName ?? o.categoryName,
      o.accountFields.map((f) => `${f.label}: ${f.value}`).join(' | '),
      String(o.totalPrice),
      STATUS_LABEL[o.status],
      new Date(o.createdAt).toLocaleDateString(),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'orders.csv';
    a.click();
  }

  return (
    <div>
      <h1 className="admin-page-title">Orders</h1>
      <p className="field-hint">All games, filterable — update status, bulk actions, export.</p>

      <div className="panel">
        <div className="orders-toolbar">
          <input
            className="field-input orders-search"
            placeholder="Search Order ID / IGN / User ID / Email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="others-sel orders-filter-sel" value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}>
            <option value="all">All Games</option>
            {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="others-sel orders-filter-sel" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <button className="qty-btn orders-bulk-btn" disabled={selected.size === 0} onClick={() => bulkUpdate('in_progress')}>
            Mark selected: In Progress
          </button>
          <button className="qty-btn orders-bulk-btn" disabled={selected.size === 0} onClick={() => bulkUpdate('done')}>
            Mark selected: Done
          </button>
          <button className="qty-btn orders-bulk-btn" onClick={exportCSV}>Export CSV</button>
        </div>

        <table className="admin-table">
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
              return (
                <>
                  <tr key={o.id}>
                    <td><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelected(o.id)} /></td>
                    <td>{shortId(o.id)}</td>
                    <td>{o.gameName}</td>
                    <td>{o.itemName ?? o.eventName ?? o.categoryName}</td>
                    <td>{primaryField}</td>
                    <td>₱{o.totalPrice}</td>
                    <td>
                      <span className={`badge badge-${o.status === 'in_progress' ? 'progress' : o.status}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                      {hasRush && <span className="badge badge-rush">RUSH</span>}
                    </td>
                    <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td>
                      <select
                        className="others-sel orders-status-sel"
                        value={o.status}
                        disabled={busyId === o.id}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                      <button className="qty-btn orders-expand-btn" onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${o.id}-expand`}>
                      <td colSpan={9}>
                        <div className="order-expand">
                          <div className="order-expand-col">
                            <h4>Account Details</h4>
                            {o.accountFields.map((f, i) => (
                              <p key={i} className="order-expand-line"><strong>{f.label}:</strong> {f.value || '—'}</p>
                            ))}
                            <p className="order-expand-line"><strong>Payment:</strong> {o.paymentMethodName}</p>
                            <p className="order-expand-line"><strong>Facebook:</strong> {o.facebookName || '—'}</p>
                            <p className="order-expand-line"><strong>Email:</strong> {o.email || '—'}</p>
                            {o.proofOfPaymentUrl && (
                              <button className="qty-btn" style={{ width: 'auto', padding: '8px 14px', marginTop: 4 }} onClick={() => viewProof(o.id)}>
                                View Proof of Payment
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
                              <button className="qty-btn" onClick={() => addNote(o.id)}>Add</button>
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
      </div>

      {proofModalUrl && (
        <div className="qr-modal-overlay" onClick={() => setProofModalUrl(null)}>
          <div
            className="qr-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '95vw', height: '95vh', maxWidth: 'none', maxHeight: 'none', display: 'flex', flexDirection: 'column' }}
          >
            <button className="qr-modal-close" onClick={() => setProofModalUrl(null)}>✕</button>
            <h3>Proof of Payment</h3>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img
                src={proofModalUrl}
                alt="Proof of payment"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}