import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';

// PATCH /api/orders/:id — status update, logs to OrderStatusHistory
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { status } = await req.json();
  if (!['pending', 'in_progress', 'done'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const [updated] = await prisma.$transaction([
    prisma.order.update({ where: { id: params.id }, data: { status } }),
    prisma.orderStatusHistory.create({
      data: { orderId: params.id, oldStatus: existing.status, newStatus: status, adminId: session.adminId },
    }),
  ]);

  return NextResponse.json(updated);
}
