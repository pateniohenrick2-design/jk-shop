import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.group !== undefined) data.group = body.group;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const category = await prisma.category.update({ where: { id: params.id }, data });
  return NextResponse.json(category);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const categoryId = params.id;

  const orderCount = await prisma.order.count({ where: { categoryId } });
  if (orderCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${orderCount} order(s) reference this category.` },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.eventSchedule.deleteMany({ where: { event: { categoryId } } }),
    prisma.eventHero.deleteMany({ where: { event: { categoryId } } }),
    prisma.event.deleteMany({ where: { categoryId } }),
    prisma.pricelistItem.deleteMany({ where: { categoryId } }),
    prisma.formField.deleteMany({ where: { categoryId } }),
    prisma.category.delete({ where: { id: categoryId } }),
  ]);

  return NextResponse.json({ ok: true });
}