import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.price !== undefined) data.price = body.price;
  if (body.originalPrice !== undefined) data.originalPrice = body.originalPrice;
  if (body.status !== undefined) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const item = await prisma.pricelistItem.update({ where: { id: params.id }, data });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const itemId = params.id;

  const orderCount = await prisma.order.count({ where: { itemId } });
  if (orderCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${orderCount} order(s) reference this item. Mark it Sold Out instead.` },
      { status: 409 }
    );
  }

  await prisma.pricelistItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}