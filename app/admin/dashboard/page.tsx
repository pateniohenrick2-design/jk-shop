import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const AGING_THRESHOLD_DAYS = 2;

function daysSince(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function firstFieldValue(accountFields: unknown): string {
  if (accountFields && typeof accountFields === 'object') {
    const vals = Object.values(accountFields as Record<string, unknown>);
    if (vals.length > 0) return String(vals[0]);
  }
  return '—';
}

export default async function AdminDashboardPage() {
  const games = await prisma.game.findMany({
    orderBy: { name: 'asc' },
    include: { orders: { select: { status: true } } },
  });
  const topGames = [...games].sort((a, b) => b.orders.length - a.orders.length).slice(0, 4);

  const agingOrders = await prisma.order.findMany({
    where: { status: 'pending' },
    include: { game: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  const aging = agingOrders
    .filter((o) => daysSince(o.createdAt) > AGING_THRESHOLD_DAYS)
    .slice(0, 10);

  const rushNotes = await prisma.orderNote.findMany({
    where: { noteText: { contains: 'rush', mode: 'insensitive' } },
    include: { order: { include: { game: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const seenOrderIds = new Set<string>();
  const rushFlags = rushNotes.filter((n) => {
    if (n.order.status === 'done' || seenOrderIds.has(n.order.id)) return false;
    seenOrderIds.add(n.order.id);
    return true;
  }).slice(0, 10);

  return (
    <div>
      <h1 className="admin-page-title">Dashboard</h1>
      <p className="field-hint">Order backlog at a glance, per game.</p>

      <div className="panel">
        <div className="stat-grid">
          {topGames.map((g) => {
            const pending = g.orders.filter((o) => o.status === 'pending').length;
            const inProgress = g.orders.filter((o) => o.status === 'in_progress').length;
            const done = g.orders.filter((o) => o.status === 'done').length;
            return (
              <div className="stat-card" key={g.id}>
                <div className="stat-num">{g.orders.length}</div>
                <div className="stat-label">{g.name}</div>
                <div className="stat-sub">{pending} pending · {inProgress} in progress · {done} done</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="col2">
        <div className="panel">
          <h3 className="panel-subhead">⚠ Aging / SLA Alerts</h3>
          {aging.length === 0 && <p className="field-hint">No aging orders 🎉</p>}
          {aging.map((o) => (
            <div className="list-row" key={o.id}>
              <span>{o.id.slice(-6).toUpperCase()} — {o.game.name} ({firstFieldValue(o.accountFields)})</span>
              <span className="badge badge-pending">Pending {daysSince(o.createdAt)}d</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h3 className="panel-subhead">🚩 Rush-Request Flags</h3>
          {rushFlags.length === 0 && <p className="field-hint">No rush flags.</p>}
          {rushFlags.map((n) => (
            <div className="list-row" key={n.id}>
              <span>{n.order.id.slice(-6).toUpperCase()} — {n.order.game.name}</span>
              <span className="badge badge-rush">Rush noted</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}