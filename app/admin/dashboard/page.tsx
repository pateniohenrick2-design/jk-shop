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
  // All independent → run at the same time. Order counts are done by the database
  // (groupBy) instead of downloading every order just to count statuses.
  const [gameRows, statusCounts, agingOrders, rushNotes] = await Promise.all([
    prisma.game.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.order.groupBy({ by: ['gameId', 'status'], _count: { _all: true } }),
    prisma.order.findMany({
      where: { status: 'pending' },
      include: { game: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
    prisma.orderNote.findMany({
      where: { noteText: { contains: 'rush', mode: 'insensitive' } },
      include: { order: { include: { game: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const games = gameRows.map((g) => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of statusCounts) {
      if (row.gameId !== g.id) continue;
      counts[row.status] = row._count._all;
      total += row._count._all;
    }
    return { ...g, counts, total };
  });
  const topGames = [...games].sort((a, b) => b.total - a.total).slice(0, 4);

  const aging = agingOrders
    .filter((o) => daysSince(o.createdAt) > AGING_THRESHOLD_DAYS)
    .slice(0, 10);

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
            const pending = g.counts.pending ?? 0;
            const inProgress = g.counts.in_progress ?? 0;
            const done = g.counts.done ?? 0;
            return (
              <div className="stat-card" key={g.id}>
                <div className="stat-num">{g.total}</div>
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