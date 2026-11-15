import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/adminSession';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.group !== undefined) data.group = body.group;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  // Availability (Pre-Order Event etc.): on/off + optional open/close date-times (ISO or null)
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  for (const key of ['availableFrom', 'availableUntil'] as const) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === '') { data[key] = null; continue; }
    const d = new Date(body[key]);
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
    data[key] = d;
  }

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