import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';

// GET /api/admin/order-updates?since=<ISO> — what changed since the admin's last check.
// Polled by the Orders page every few seconds, so it only returns ids + statuses (tiny + fast).
export async function GET(req: NextRequest) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const sinceParam = req.nextUrl.searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : null;
  if (!since || isNaN(since.getTime())) {
    return NextResponse.json({ now: now.toISOString(), changed: [], newOrders: 0 }, { headers: { 'Cache-Control': 'no-store' } });
  }
  // Small overlap so a change saved at the same instant as the last check is never missed
  const from = new Date(since.getTime() - 2000);

  const [changed, newOrders] = await Promise.all([
    prisma.order.findMany({
      where: { updatedAt: { gt: from } },
      select: { id: true, status: true },
      take: 500,
    }),
    prisma.order.count({ where: { createdAt: { gt: from } } }),
  ]);

  return NextResponse.json({ now: now.toISOString(), changed, newOrders }, { headers: { 'Cache-Control': 'no-store' } });
}
