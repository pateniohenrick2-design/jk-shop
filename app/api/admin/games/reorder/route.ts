import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
  try {
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Invalid ids' }, { status: 400 });
    }

    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.game.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to reorder games:', err);
    return NextResponse.json(
      { error: 'Failed to reorder games' },
      { status: 500 },
    );
  }
}