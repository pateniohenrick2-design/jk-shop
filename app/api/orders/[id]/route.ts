import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';
import { isOrderStatus } from '@/lib/orderStatus';
import { waitUntil } from '@vercel/functions';
import { sendStatusToSheet } from '@/lib/gsheet';

// PATCH /api/orders/:id — status update, logs to OrderStatusHistory
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { status, supplier } = await req.json();
  // PROCESS button: which top-up site was used (written to the sheet's Supplier column if empty)
  const supplierName = typeof supplier === 'string' ? supplier.trim().slice(0, 60) : '';
  if (!isOrderStatus(status)) {
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

  // Mirror the change in the Google Sheet after responding (never blocks or fails the admin's change)
  if (updated.orderCode && (existing.status !== status || supplierName)) {
    waitUntil(sendStatusToSheet([{ orderCode: updated.orderCode, status, ...(supplierName ? { supplier: supplierName } : {}) }]));
  }

  return NextResponse.json(updated);
}
