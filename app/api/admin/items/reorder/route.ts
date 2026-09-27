import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { ids } = body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required.' }, { status: 400 });
  }
  await prisma.$transaction(
    ids.map((id, index) => prisma.pricelistItem.update({ where: { id }, data: { sortOrder: index } }))
  );
  return NextResponse.json({ ok: true });
}