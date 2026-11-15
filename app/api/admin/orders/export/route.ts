import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/adminSession';
import { buildOrderWhere, readOrderFilters } from '@/lib/adminOrders';
import { statusLabel, isGiftingCategory } from '@/lib/orderStatus';

// GET /api/admin/orders/export?q=&game=&status= — CSV of EVERY order matching the filters
// (the Orders page itself only loads 10 at a time).
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const filters = readOrderFilters(Object.fromEntries(req.nextUrl.searchParams));
  const orders = await prisma.order.findMany({
    where: await buildOrderWhere(filters),
    orderBy: { createdAt: 'desc' },
    take: 5000,
    include: {
      game: { select: { name: true } },
      category: { select: { name: true, fields: { orderBy: { sortOrder: 'asc' }, select: { id: true, label: true } } } },
      item: { select: { name: true } },
      event: { select: { name: true } },
      paymentMethod: { select: { name: true } },
    },
  });

  const header = ['Order', 'Date', 'Game', 'Item / Category', 'Customer Fields', 'Qty', 'Amount', 'Payment', 'Facebook', 'Email', 'Status'];
  const rows = orders.map((o) => {
    const raw = (o.accountFields ?? {}) as Record<string, string>;
    return [
      o.orderCode ?? o.id,
      o.createdAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
      o.game.name,
      o.item?.name ?? o.event?.name ?? o.category.name,
      o.category.fields.map((f) => `${f.label}: ${raw[f.id] ?? ''}`).join(' | '),
      String(o.quantity),
      String(Number(o.totalPrice)),
      o.paymentMethod.name,
      o.facebookName ?? '',
      o.email ?? '',
      statusLabel(o.status, isGiftingCategory(o.category.name)),
    ];
  });
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
