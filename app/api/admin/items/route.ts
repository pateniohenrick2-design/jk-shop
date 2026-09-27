import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { categoryId, name, price, originalPrice, status, notes } = body;
  if (!categoryId || !name || price === undefined) {
    return NextResponse.json({ error: 'categoryId, name, and price are required.' }, { status: 400 });
  }
  const max = await prisma.pricelistItem.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });
  const item = await prisma.pricelistItem.create({
    data: {
      categoryId,
      name,
      price,
      originalPrice: originalPrice ?? null,
      status: status ?? 'available',
      notes: notes ?? null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json(item);
}