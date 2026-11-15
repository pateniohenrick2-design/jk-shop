import Link from 'next/link';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { manilaStartOfDay, toManilaDateString } from '@/lib/manilaDate';
import { statusBadgeClass, statusLabel } from '@/lib/orderStatus';
import { availabilityState, isPreOrderCategory } from '@/lib/categoryAvailability';
import SalesChart, { type SalesPoint } from './SalesChart';

export const revalidate = 0;

// The order sheet (Apps Script syncs statuses both ways). Override with GSHEET_URL if it ever moves.
const SHEET_URL =
  process.env.GSHEET_URL || 'https://docs.google.com/spreadsheets/d/1riVksvM21lM0VzDS-KK09q4z-FAtctPVMA0YNtD9EjA/edit';

const AGING_DAYS = 2; // pending longer than this = overdue
const DAY = 86_400_000;

const RANGES = {
  today: { label: 'Today', days: 1 },
  '7d': { label: '7 days', days: 7 },
  '30d': { label: '30 days', days: 30 },
  '90d': { label: '90 days', days: 90 },
} as const;
type RangeKey = keyof typeof RANGES;

// Not counted as sales
const NOT_SALES: OrderStatus[] = ['refund', 'failed'];
const COMPLETED: OrderStatus[] = ['successful', 'done'];

const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;
const ago = (d: Date) => {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
const manilaDateLabel = (d: Date) => d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
const manilaDateTime = (d: Date) =>
  d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const manilaHour = (d: Date) => Number(d.toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false })) % 24;

// "+12% vs previous 30 days" — null when there's nothing to compare against
function delta(current: number, previous: number): { pct: number; up: boolean } | null {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct, up: pct >= 0 };
}

function Delta({ d, period }: { d: { pct: number; up: boolean } | null; period: string }) {
  if (!d) return <span className="dash-delta muted">No data for previous {period}</span>;
  return (
    <span className={`dash-delta ${d.pct === 0 ? 'flat' : d.up ? 'up' : 'down'}`}>
      {d.pct === 0 ? '→' : d.up ? '▲' : '▼'} {Math.abs(d.pct)}% <span className="muted">vs previous {period}</span>
    </span>
  );
}

// Ranked horizontal bars (one hue): label, bar, value at the tip
function RankedBars({ rows, format }: { rows: { key: string; label: React.ReactNode; value: number; sub?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="dash-bars">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="dash-bars-label">{r.label}{r.sub && <span className="muted"> · {r.sub}</span>}</div>
          <div className="dash-bars-track">
            <span className="dash-bars-fill" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            <span className="dash-bars-value">{format(r.value)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: { range?: string } }) {
  const rangeKey: RangeKey = (searchParams.range && searchParams.range in RANGES ? searchParams.range : '30d') as RangeKey;
  const { days, label: rangeLabel } = RANGES[rangeKey];
  const now = new Date();
  const start = manilaStartOfDay(toManilaDateString(new Date(now.getTime() - (days - 1) * DAY)))!;
  const prevStart = new Date(start.getTime() - days * DAY);
  const period = rangeKey === 'today' ? 'day' : `${days} days`;

  // Everything is independent → one round of parallel queries
  const [
    rangeOrders, prevByStatus, liveByStatus, oldestPending, games, payments,
    recentOrders, recentChanges, soldOutItems, preorderCats, activeEvents, overdueCount,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start } },
      select: {
        createdAt: true, totalPrice: true, status: true, gameId: true, paymentMethodId: true,
        email: true, customerId: true, quantity: true,
        item: { select: { name: true } }, event: { select: { name: true } }, category: { select: { name: true } },
      },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: prevStart, lt: start } },
      _count: { _all: true },
      _sum: { totalPrice: true },
    }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 6,
      select: {
        id: true, orderCode: true, createdAt: true, totalPrice: true,
        game: { select: { name: true } }, item: { select: { name: true } }, event: { select: { name: true } },
      },
    }),
    prisma.game.findMany({ select: { id: true, name: true } }),
    prisma.paymentMethod.findMany({ select: { id: true, name: true } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true, orderCode: true, createdAt: true, totalPrice: true, status: true,
        game: { select: { name: true } }, item: { select: { name: true } }, event: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.orderStatusHistory.findMany({
      orderBy: { changedAt: 'desc' },
      take: 8,
      select: {
        id: true, changedAt: true, oldStatus: true, newStatus: true,
        changedBy: { select: { username: true } },
        order: { select: { orderCode: true, category: { select: { name: true } } } },
      },
    }),
    prisma.pricelistItem.count({ where: { status: 'sold_out' } }),
    prisma.category.findMany({
      where: { OR: [{ name: { contains: 'order', mode: 'insensitive' } }, { isActive: false }, { availableFrom: { not: null } }, { availableUntil: { not: null } }] },
      select: { id: true, name: true, isActive: true, availableFrom: true, availableUntil: true, game: { select: { name: true } } },
    }),
    prisma.event.findMany({
      where: { endDate: { gte: now } },
      orderBy: { endDate: 'asc' },
      take: 5,
      select: { id: true, name: true, startDate: true, endDate: true, schedule: { select: { soldOutAt: true } } },
    }),
    // Every pending order older than AGING_DAYS (the list above only shows the oldest 6)
    prisma.order.count({ where: { status: 'pending', createdAt: { lt: new Date(now.getTime() - AGING_DAYS * DAY) } } }),
  ]);

  // ---------- Live backlog (not affected by the date range) ----------
  const live = Object.fromEntries(liveByStatus.map((r) => [r.status, r._count._all])) as Partial<Record<OrderStatus, number>>;
  const pendingCount = live.pending ?? 0;
  const inProgressCount = live.in_progress ?? 0;
  const giftingWaiting = (live.reserved ?? 0) + (live.friends ?? 0);
  const oldest = oldestPending[0];
  // Pre-order categories, plus any category that's switched off or scheduled
  const preorders = preorderCats.filter((c) => isPreOrderCategory(c.name) || !c.isActive || c.availableFrom || c.availableUntil);

  // ---------- Selected range ----------
  const valid = rangeOrders.filter((o) => !NOT_SALES.includes(o.status));
  const sales = valid.reduce((s, o) => s + Number(o.totalPrice), 0);
  const orderCount = rangeOrders.length;
  const avgOrder = valid.length ? sales / valid.length : 0;
  const completedCount = rangeOrders.filter((o) => COMPLETED.includes(o.status)).length;
  const completedRate = orderCount ? Math.round((completedCount / orderCount) * 100) : 0;
  const customers = new Set(rangeOrders.map((o) => o.customerId || o.email?.toLowerCase() || '')).size;
  const refundedFailed = orderCount - valid.length;

  const prevSales = prevByStatus.filter((r) => !NOT_SALES.includes(r.status)).reduce((s, r) => s + Number(r._sum.totalPrice ?? 0), 0);
  const prevValid = prevByStatus.filter((r) => !NOT_SALES.includes(r.status)).reduce((s, r) => s + r._count._all, 0);
  const prevOrders = prevByStatus.reduce((s, r) => s + r._count._all, 0);
  const prevAvg = prevValid ? prevSales / prevValid : 0;

  // Sales trend: per hour for "Today", per day otherwise (Manila time)
  const unit: 'day' | 'hour' = rangeKey === 'today' ? 'hour' : 'day';
  const buckets = new Map<string, SalesPoint>();
  if (unit === 'hour') {
    for (let h = 0; h < 24; h++) {
      const label = `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
      buckets.set(String(h), { key: String(h), label, sales: 0, orders: 0 });
    }
  } else {
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * DAY + 12 * 3600_000); // midday avoids edge cases
      const key = toManilaDateString(d);
      buckets.set(key, { key, label: manilaDateLabel(d), sales: 0, orders: 0 });
    }
  }
  for (const o of valid) {
    const key = unit === 'hour' ? String(manilaHour(o.createdAt)) : toManilaDateString(o.createdAt);
    const b = buckets.get(key);
    if (b) { b.sales += Number(o.totalPrice); b.orders += 1; }
  }
  const points = Array.from(buckets.values());
  const bestDay = unit === 'day' ? points.reduce((a, b) => (b.sales > a.sales ? b : a), points[0]) : null;

  // Breakdowns (valid sales only)
  const gameName = new Map(games.map((g) => [g.id, g.name]));
  const payName = new Map(payments.map((p) => [p.id, p.name]));
  const sumBy = (keyOf: (o: (typeof valid)[number]) => string) => {
    const m = new Map<string, { sales: number; orders: number }>();
    for (const o of valid) {
      const k = keyOf(o);
      const cur = m.get(k) ?? { sales: 0, orders: 0 };
      cur.sales += Number(o.totalPrice);
      cur.orders += 1;
      m.set(k, cur);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].sales - a[1].sales);
  };
  const byGame = sumBy((o) => gameName.get(o.gameId) ?? 'Unknown game').slice(0, 8);
  const byPayment = sumBy((o) => payName.get(o.paymentMethodId) ?? 'Unknown');
  const topItems = (() => {
    const m = new Map<string, { item: string; game: string; qty: number; orders: number; sales: number }>();
    for (const o of valid) {
      const item = o.item?.name ?? o.event?.name ?? o.category.name;
      const game = gameName.get(o.gameId) ?? '';
      const k = `${game}|${item}`;
      const cur = m.get(k) ?? { item, game, qty: 0, orders: 0, sales: 0 };
      cur.qty += o.quantity;
      cur.orders += 1;
      cur.sales += Number(o.totalPrice);
      m.set(k, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.sales - a.sales).slice(0, 8);
  })();
  const rangeStatus = (() => {
    const m = new Map<OrderStatus, number>();
    for (const o of rangeOrders) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  })();

  const orderTitle = (o: { item: { name: string } | null; event: { name: string } | null; category?: { name: string } }) =>
    o.item?.name ?? o.event?.name ?? o.category?.name ?? 'Order';

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="field-hint" style={{ margin: 0 }}>
            {now.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric' })} · Philippine time
          </p>
        </div>
        <div className="dash-head-links">
          <Link href="/admin/orders" className="pl-btn">Orders</Link>
          <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" className="pl-btn">Google Sheet ↗</a>
        </div>
      </div>

      {/* ---------- Needs attention (live) ---------- */}
      <section className="panel dash-attention" aria-labelledby="dash-attn">
        <h2 id="dash-attn" className="dash-h2">Needs attention <span className="muted">· right now</span></h2>
        <div className="dash-tiles">
          <Link href="/admin/orders" className={`dash-tile${pendingCount > 0 ? ' warn' : ''}`}>
            <span className="dash-tile-label">Pending orders</span>
            <span className="dash-tile-value">{pendingCount}</span>
            <span className="dash-tile-sub">{oldest ? `Oldest ${ago(oldest.createdAt)}` : 'All caught up'}</span>
          </Link>
          <Link href="/admin/orders" className="dash-tile">
            <span className="dash-tile-label">In progress</span>
            <span className="dash-tile-value">{inProgressCount}</span>
            <span className="dash-tile-sub">Being processed</span>
          </Link>
          <Link href="/admin/orders" className="dash-tile">
            <span className="dash-tile-label">Gifting waiting</span>
            <span className="dash-tile-value">{giftingWaiting}</span>
            <span className="dash-tile-sub">{live.reserved ?? 0} reserved · {live.friends ?? 0} friends</span>
          </Link>
          <Link href="/admin/orders" className={`dash-tile${overdueCount > 0 ? ' danger' : ''}`}>
            <span className="dash-tile-label">Overdue</span>
            <span className="dash-tile-value">{overdueCount}</span>
            <span className="dash-tile-sub">Pending over {AGING_DAYS} days</span>
          </Link>
          <Link href="/admin/pricelists" className="dash-tile">
            <span className="dash-tile-label">Sold-out items</span>
            <span className="dash-tile-value">{soldOutItems}</span>
            <span className="dash-tile-sub">Hidden from ordering</span>
          </Link>
        </div>

        <div className="dash-attn-lists">
          <div>
            <h3 className="dash-h3">Oldest pending</h3>
            {oldestPending.length === 0 ? (
              <p className="field-hint">No pending orders 🎉</p>
            ) : (
              <ul className="dash-list">
                {oldestPending.map((o) => {
                  const late = now.getTime() - o.createdAt.getTime() > AGING_DAYS * DAY;
                  return (
                    <li key={o.id}>
                      <span className="dash-list-main">
                        <strong>{o.orderCode ?? o.id.slice(-6).toUpperCase()}</strong>
                        <span className="muted">{o.game.name} · {orderTitle(o)}</span>
                      </span>
                      <span className={`badge ${late ? 'badge-failed' : 'badge-pending'}`}>{late ? '⚠ ' : ''}{ago(o.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <h3 className="dash-h3">Events &amp; pre-orders</h3>
            <ul className="dash-list">
              {preorders.map((c) => {
                const st = availabilityState(c);
                const text =
                  st === 'disabled' ? 'Switched off'
                    : st === 'upcoming' ? `Opens ${manilaDateTime(c.availableFrom!)}`
                    : st === 'closed' ? `Closed ${manilaDateTime(c.availableUntil!)}`
                    : c.availableUntil ? `Open · closes ${manilaDateTime(c.availableUntil)}` : 'Open';
                return (
                  <li key={c.id}>
                    <span className="dash-list-main">
                      <strong>{c.name}</strong>
                      <span className="muted">{c.game.name}</span>
                    </span>
                    <span className={`badge ${st === 'open' ? 'badge-successful' : st === 'upcoming' ? 'badge-pending' : 'badge-failed'}`}>{text}</span>
                  </li>
                );
              })}
              {activeEvents.map((e) => {
                const soldOut = e.schedule.filter((s) => s.soldOutAt && s.soldOutAt <= now).length;
                return (
                  <li key={e.id}>
                    <span className="dash-list-main">
                      <strong>{e.name}</strong>
                      <span className="muted">
                        Ends {manilaDateLabel(e.endDate)}
                        {e.schedule.length > 0 && ` · ${soldOut}/${e.schedule.length} schedules sold out`}
                      </span>
                    </span>
                    <span className={`badge ${e.startDate > now ? 'badge-pending' : 'badge-successful'}`}>{e.startDate > now ? 'Upcoming' : 'Live'}</span>
                  </li>
                );
              })}
              {preorders.length === 0 && activeEvents.length === 0 && <li className="field-hint">No active events.</li>}
            </ul>
            <Link href="/admin/events" className="dash-more">Manage events →</Link>
          </div>
        </div>
      </section>

      {/* ---------- Date range: scopes everything below ---------- */}
      <nav className="dash-range" aria-label="Date range">
        {(Object.keys(RANGES) as RangeKey[]).map((k) => (
          <Link key={k} href={`/admin/dashboard?range=${k}`} className={`dash-range-btn${k === rangeKey ? ' active' : ''}`} aria-current={k === rangeKey ? 'page' : undefined}>
            {RANGES[k].label}
          </Link>
        ))}
        <span className="muted dash-range-note">
          {rangeKey === 'today' ? 'Today' : `${manilaDateLabel(start)} – ${manilaDateLabel(now)}`} · refunds &amp; failed orders aren&apos;t counted as sales
        </span>
      </nav>

      {/* ---------- Sales (hero) + trend ---------- */}
      <section className="panel dash-sales" aria-labelledby="dash-sales">
        <div className="dash-sales-head">
          <div>
            <h2 id="dash-sales" className="dash-h2">Sales · {rangeLabel.toLowerCase()}</h2>
            <div className="dash-hero">{peso(sales)}</div>
            <Delta d={delta(sales, prevSales)} period={period} />
          </div>
          {bestDay && bestDay.sales > 0 && (
            <div className="dash-best">
              <span className="muted">Best day</span>
              <strong>{peso(bestDay.sales)}</strong>
              <span className="muted">{bestDay.label} · {bestDay.orders} orders</span>
            </div>
          )}
        </div>
        <SalesChart points={points} unit={unit} />
      </section>

      {/* ---------- KPI row ---------- */}
      <div className="dash-kpis">
        <div className="dash-kpi">
          <span className="dash-tile-label">Orders</span>
          <span className="dash-kpi-value">{orderCount.toLocaleString('en-PH')}</span>
          <Delta d={delta(orderCount, prevOrders)} period={period} />
        </div>
        <div className="dash-kpi">
          <span className="dash-tile-label">Average order</span>
          <span className="dash-kpi-value">{peso(avgOrder)}</span>
          <Delta d={delta(avgOrder, prevAvg)} period={period} />
        </div>
        <div className="dash-kpi">
          <span className="dash-tile-label">Completed</span>
          <span className="dash-kpi-value">{completedRate}%</span>
          <span className="dash-delta muted">{completedCount} of {orderCount} orders</span>
        </div>
        <div className="dash-kpi">
          <span className="dash-tile-label">Customers</span>
          <span className="dash-kpi-value">{customers.toLocaleString('en-PH')}</span>
          <span className="dash-delta muted">{refundedFailed > 0 ? `${refundedFailed} refunded / failed` : 'No refunds or failed orders'}</span>
        </div>
      </div>

      {/* ---------- Breakdowns ---------- */}
      <div className="col2 dash-col2">
        <section className="panel" aria-labelledby="dash-games">
          <h2 id="dash-games" className="dash-h2">Sales by game</h2>
          {byGame.length === 0 ? <p className="field-hint">No sales in this period.</p> : (
            <RankedBars rows={byGame.map(([name, v]) => ({ key: name, label: name, value: v.sales, sub: `${v.orders} order${v.orders === 1 ? '' : 's'}` }))} format={peso} />
          )}
        </section>
        <section className="panel" aria-labelledby="dash-status">
          <h2 id="dash-status" className="dash-h2">Orders by status</h2>
          {rangeStatus.length === 0 ? <p className="field-hint">No orders in this period.</p> : (
            <RankedBars
              rows={rangeStatus.map(([s, n]) => ({
                key: s,
                label: <span className={statusBadgeClass(s)}>{statusLabel(s)}</span>,
                value: n,
                sub: `${Math.round((n / orderCount) * 100)}%`,
              }))}
              format={(n) => n.toLocaleString('en-PH')}
            />
          )}
        </section>
      </div>

      <div className="col2 dash-col2">
        <section className="panel" aria-labelledby="dash-items">
          <h2 id="dash-items" className="dash-h2">Top items</h2>
          {topItems.length === 0 ? <p className="field-hint">No sales in this period.</p> : (
            <div className="dash-table-wrap">
              <table className="admin-table dash-mini-table">
                <thead><tr><th>Item</th><th className="num">Orders</th><th className="num">Sales</th></tr></thead>
                <tbody>
                  {topItems.map((t) => (
                    <tr key={`${t.game}|${t.item}`}>
                      <td><strong>{t.item}</strong><div className="muted dash-small">{t.game}{t.qty !== t.orders ? ` · qty ${t.qty}` : ''}</div></td>
                      <td className="num">{t.orders}</td>
                      <td className="num">{peso(t.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel" aria-labelledby="dash-pay">
          <h2 id="dash-pay" className="dash-h2">Payment methods</h2>
          {byPayment.length === 0 ? <p className="field-hint">No sales in this period.</p> : (
            <RankedBars
              rows={byPayment.map(([name, v]) => ({ key: name, label: name, value: v.sales, sub: `${Math.round((v.sales / (sales || 1)) * 100)}% · ${v.orders} orders` }))}
              format={peso}
            />
          )}
        </section>
      </div>

      {/* ---------- Activity ---------- */}
      <div className="col2 dash-col2">
        <section className="panel" aria-labelledby="dash-recent">
          <div className="dash-panel-head">
            <h2 id="dash-recent" className="dash-h2">Latest orders</h2>
            <Link href="/admin/orders" className="dash-more">All orders →</Link>
          </div>
          {recentOrders.length === 0 ? <p className="field-hint">No orders yet.</p> : (
            <ul className="dash-list">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <span className="dash-list-main">
                    <strong>{o.orderCode ?? o.id.slice(-6).toUpperCase()} · {peso(Number(o.totalPrice))}</strong>
                    <span className="muted">{o.game.name} · {orderTitle(o)} · {ago(o.createdAt)}</span>
                  </span>
                  <span className={statusBadgeClass(o.status)}>{statusLabel(o.status, /event skin gifting/i.test(o.category.name))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel" aria-labelledby="dash-changes">
          <div className="dash-panel-head">
            <h2 id="dash-changes" className="dash-h2">Status changes</h2>
            <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" className="dash-more">Open sheet ↗</a>
          </div>
          {recentChanges.length === 0 ? <p className="field-hint">No status changes yet.</p> : (
            <ul className="dash-list">
              {recentChanges.map((c) => {
                const gifting = /event skin gifting/i.test(c.order.category.name);
                return (
                  <li key={c.id}>
                    <span className="dash-list-main">
                      <strong>{c.order.orderCode ?? '—'}</strong>
                      <span className="muted">
                        {c.oldStatus ? `${statusLabel(c.oldStatus, gifting)} → ` : ''}{statusLabel(c.newStatus, gifting)} · {ago(c.changedAt)}
                      </span>
                    </span>
                    {/* No admin on the change = it came from the Google Sheet */}
                    <span className={`dash-source ${c.changedBy ? 'admin' : 'sheet'}`}>
                      {c.changedBy ? `👤 ${c.changedBy.username}` : '📄 Google Sheet'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <p className="field-hint dash-foot">
        Supplier prices and profit are kept in the Google Sheet, so they aren&apos;t shown here. Last updated {manilaDateTime(now)}.
      </p>
    </div>
  );
}
