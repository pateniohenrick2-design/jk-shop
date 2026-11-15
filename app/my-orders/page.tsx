'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { useCustomer } from '@/lib/useCustomer';
import type { CustomerOrder } from '@/lib/customerOrders';
import { screenshotHref } from '@/lib/accountValue';
import { customerStatusLabel, isGiftingCategory, statusBadgeClass } from '@/lib/orderStatus';

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// Order details + status (updated by the shop from the Google Sheet or the admin).
function OrderCard({ o }: { o: CustomerOrder }) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="to-card">
      <div className="to-card-top">
        <button
          className="to-code"
          title="Copy Order ID"
          onClick={() => {
            navigator.clipboard?.writeText(o.orderCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
          }}
        >
          {o.orderCode} <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
        <span className="to-date">{when(o.createdAt)}</span>
      </div>
      <span className={`${statusBadgeClass(o.status)} to-status`}>{customerStatusLabel(o.status, isGiftingCategory(o.category))}</span>

      <h3 className="to-item">
        {o.item}{o.quantity > 1 && <span> × {o.quantity}</span>}
      </h3>
      <p className="to-game">{o.game} · {o.category}</p>

      {o.account.length > 0 && (
        <dl className="to-account">
          {o.account.map((a) => (
            <div key={a.label}><dt>{a.label}</dt><dd>{screenshotHref(a.value)
              ? <a href={screenshotHref(a.value)!} target="_blank" rel="noopener noreferrer">View screenshot ↗</a>
              : a.value}</dd></div>
          ))}
        </dl>
      )}

      <div className="to-card-foot">
        <span>{o.quantity > 1 ? `${o.quantity} × ${peso(o.unitPrice)}` : 'Total'}</span>
        <span>Paid via {o.paymentMethod}</span>
        <strong>{peso(o.totalPrice)}</strong>
      </div>
    </article>
  );
}

function MyOrders() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(''); // the query actually sent (after a short typing pause)
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1, pageSize: 10 });

  const url = (p: number, q: string) => `/api/my-orders?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  // Search after the customer stops typing, from page 1
  useEffect(() => {
    const t = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    const request = (token?: string) =>
      fetch(url(page, search), { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
    try {
      const { data } = await supabase.auth.getSession();
      let res = await request(data.session?.access_token);
      // Phones often wake a tab with an expired login token: refresh it once and retry
      if (res.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session) res = await request(refreshed.session.access_token);
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Could not load your orders (error ${res.status}). Please tap Refresh.`);
      if (!Array.isArray(body.orders)) throw new Error('Could not load your orders (unexpected reply). Please tap Refresh.');
      setOrders(body.orders);
      setMeta({ total: body.total ?? body.orders.length, pages: body.pages ?? 1, pageSize: body.pageSize ?? 10 });
      if (body.page && body.page !== page) setPage(body.page);
    } catch (e: any) {
      // Network failures ("Failed to fetch" / "Load failed") get a clearer message
      const msg = e?.message && !/failed to fetch|load failed|network/i.test(e.message)
        ? e.message
        : 'Could not reach the server. Check your internet connection, then tap Refresh.';
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Statuses change while the page is open (the shop updates them): re-check every 30s
  // while the tab is visible, and right away when the customer comes back to it.
  useEffect(() => {
    const quiet = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch(url(page, search), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json();
        if (Array.isArray(body.orders)) {
          setOrders(body.orders);
          setMeta({ total: body.total ?? body.orders.length, pages: body.pages ?? 1, pageSize: body.pageSize ?? 10 });
        }
      } catch { /* offline for a moment: next tick retries */ }
    };
    const t = setInterval(quiet, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') quiet(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const shown = orders ?? []; // this page, already searched by the server
  const goPage = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <>
      <div className="to-head">
        <div>
          <h1>My Orders</h1>
          <p>Every order you placed while logged in, plus earlier orders that used your email.</p>
        </div>
        <button className="pl-btn" onClick={load} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh'}</button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {orders === null && !error && <div className="to-empty">Loading your orders…</div>}

      {orders && orders.length === 0 && !search && (
        <div className="to-empty">
          <p>You don’t have any orders yet.</p>
          <Link href="/" className="auth-login-btn">Browse games</Link>
        </div>
      )}

      {orders && (orders.length > 0 || !!search) && (
        <>
          <div className="to-toolbar">
            <span className="to-count">{meta.total} order{meta.total === 1 ? '' : 's'}{search ? ` matching “${search}”` : ''}</span>
            <input className="pl-search" type="search" placeholder="Search Order ID or item…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {shown.length === 0 ? (
            <div className="to-empty">No orders match “{query}”.</div>
          ) : (
            <div className="to-list">{shown.map((o) => <OrderCard key={o.orderCode} o={o} />)}</div>
          )}
          {meta.pages > 1 && (
            <nav className="orders-pager" aria-label="Order pages">
              <span className="orders-pager-info">
                Showing {(page - 1) * meta.pageSize + 1}–{Math.min(meta.total, page * meta.pageSize)} of {meta.total}
              </span>
              <div className="orders-pager-btns">
                <button type="button" className="orders-page-btn" disabled={page <= 1 || refreshing} onClick={() => goPage(page - 1)}>‹ Previous</button>
                <span className="orders-pager-info">Page {page} of {meta.pages}</span>
                <button type="button" className="orders-page-btn" disabled={page >= meta.pages || refreshing} onClick={() => goPage(page + 1)}>Next ›</button>
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}

function GuestLookup() {
  const [orderCode, setOrderCode] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CustomerOrder | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOrder(null);
    if (!orderCode.trim() || !email.trim()) return setError('Enter your Order ID and the email you used.');
    setBusy(true);
    try {
      const res = await fetch('/api/track-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode, email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
      setOrder(body.order);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="to-head">
        <div>
          <h1>Find your order</h1>
          <p>Enter the Order ID from your confirmation (e.g. DIA-1108001) and the email you used.</p>
        </div>
      </div>

      <div className="to-guest">
        <form className="to-lookup" onSubmit={lookup} noValidate>
          <div>
            <label className="field-label" htmlFor="to-code">Order ID</label>
            <input id="to-code" className="field-input" placeholder="DIA-1108001" value={orderCode} onChange={(e) => setOrderCode(e.target.value.toUpperCase())} autoCapitalize="characters" />
          </div>
          <div>
            <label className="field-label" htmlFor="to-email">Email</label>
            <input id="to-email" className="field-input" type="email" autoComplete="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="submit-btn" type="submit" disabled={busy}>{busy ? 'Searching…' : 'Find order'}</button>
        </form>

        <div className="to-login-cta">
          <strong>See all your orders in one place</strong>
          <p>Log in and every order you place is saved to your account, so you can always find your Order IDs and details.</p>
          <Link href="/login?next=%2Fmy-orders" className="auth-login-btn">Log in / Register</Link>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {order && <div className="to-list"><OrderCard o={order} /></div>}
    </>
  );
}

export default function MyOrdersPage() {
  const { user, loading } = useCustomer();
  return (
    <>
      <Header />
      <main className="to-wrap">
        {loading ? <div className="to-empty">Loading…</div> : user ? <MyOrders /> : <GuestLookup />}
      </main>
      <Footer />
    </>
  );
}
