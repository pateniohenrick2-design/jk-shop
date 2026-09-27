import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { gameId, name, group } = body;
  if (!gameId || !name || !group) {
    return NextResponse.json({ error: 'gameId, name, and group are required.' }, { status: 400 });
  }
  const max = await prisma.category.aggregate({
    where: { gameId },
    _max: { sortOrder: true },
  });
  const category = await prisma.category.create({
    data: { gameId, name, group, sortOrder: (max._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json(category);
}