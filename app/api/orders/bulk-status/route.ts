import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderIds, status } = await req.json();
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: 'No orders selected' }, { status: 400 });
  }
  if (!['pending', 'in_progress', 'done'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const existingOrders = await prisma.order.findMany({ where: { id: { in: orderIds } } });

  await prisma.$transaction([
    prisma.order.updateMany({ where: { id: { in: orderIds } }, data: { status } }),
    prisma.orderStatusHistory.createMany({
      data: existingOrders.map((o) => ({
        orderId: o.id,
        oldStatus: o.status,
        newStatus: status,
        adminId: session.adminId,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true, updated: existingOrders.length });
}