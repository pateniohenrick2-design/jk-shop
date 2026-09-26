import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/orders/:id — status update, logs to OrderStatusHistory
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { status, adminId } = await req.json();

  const existing = await prisma.order.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const [updated] = await prisma.$transaction([
    prisma.order.update({ where: { id: params.id }, data: { status } }),
    prisma.orderStatusHistory.create({
      data: { orderId: params.id, oldStatus: existing.status, newStatus: status, adminId },
    }),
  ]);

  return NextResponse.json(updated);
}
