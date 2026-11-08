import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';
import { normalizeName } from '@/lib/parsePricelist';

type Row = {
  name: string;
  price: number;
  originalPrice?: number | null;
  status?: 'available' | 'sold_out';
  notes?: string | null;
};

// Bulk add/update items in one category, matched by name (case-insensitive).
// Body: { categoryId, rows: Row[], reorder?: boolean, markMissingSoldOut?: boolean }
export async function POST(req: NextRequest) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admins can edit pricelists.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const categoryId: string | undefined = body?.categoryId;
  const rows: Row[] = Array.isArray(body?.rows) ? body.rows : [];
  const reorder = !!body?.reorder;
  const markMissingSoldOut = !!body?.markMissingSoldOut;

  if (!categoryId) return NextResponse.json({ error: 'categoryId is required.' }, { status: 400 });
  if (rows.length === 0) return NextResponse.json({ error: 'No rows to import.' }, { status: 400 });
  if (rows.length > 500) return NextResponse.json({ error: 'Too many rows (max 500).' }, { status: 400 });
  for (const r of rows) {
    if (typeof r.name !== 'string' || !r.name.trim() || typeof r.price !== 'number' || !Number.isFinite(r.price) || r.price < 0) {
      return NextResponse.json({ error: `Invalid row: ${JSON.stringify(r).slice(0, 80)}` }, { status: 400 });
    }
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.pricelistItem.findMany({ where: { categoryId }, orderBy: { sortOrder: 'asc' } });
    const byName = new Map(existing.map((it) => [normalizeName(it.name), it]));
    const touched = new Set<string>();
    let created = 0, updated = 0, unchanged = 0, markedSoldOut = 0;
    let nextSort = existing.reduce((m, it) => Math.max(m, it.sortOrder), -1) + 1;
    const orderedIds: string[] = [];

    for (const r of rows) {
      const match = byName.get(normalizeName(r.name));
      if (match) {
        const data: Record<string, unknown> = {};
        if (Number(match.price) !== r.price) data.price = r.price;
        if (r.originalPrice !== undefined) {
          const cur = match.originalPrice == null ? null : Number(match.originalPrice);
          if (cur !== r.originalPrice) data.originalPrice = r.originalPrice;
        }
        if (r.status !== undefined && r.status !== match.status) data.status = r.status;
        if (r.notes !== undefined && (r.notes ?? null) !== (match.notes ?? null)) data.notes = r.notes;
        if (Object.keys(data).length) {
          await tx.pricelistItem.update({ where: { id: match.id }, data });
          updated++;
        } else unchanged++;
        touched.add(match.id);
        orderedIds.push(match.id);
      } else {
        const item = await tx.pricelistItem.create({
          data: {
            categoryId,
            name: r.name.trim(),
            price: r.price,
            originalPrice: r.originalPrice ?? null,
            status: r.status ?? 'available',
            notes: r.notes ?? null,
            sortOrder: nextSort++,
          },
        });
        created++;
        touched.add(item.id);
        orderedIds.push(item.id);
      }
    }

    const missing = existing.filter((it) => !touched.has(it.id));
    if (markMissingSoldOut) {
      for (const it of missing) {
        if (it.status !== 'sold_out') {
          await tx.pricelistItem.update({ where: { id: it.id }, data: { status: 'sold_out' } });
          markedSoldOut++;
        }
      }
    }

    if (reorder) {
      // Pasted order first, then any items that weren't in the paste (keeping their relative order)
      const finalOrder = [...orderedIds, ...missing.map((it) => it.id)];
      for (const [i, id] of finalOrder.entries()) {
        await tx.pricelistItem.update({ where: { id }, data: { sortOrder: i } });
      }
    }

    const items = await tx.pricelistItem.findMany({ where: { categoryId }, orderBy: { sortOrder: 'asc' } });
    return { created, updated, unchanged, markedSoldOut, items };
  }, { timeout: 30000 });

  return NextResponse.json({
    ...result,
    items: result.items.map((it) => ({
      ...it,
      price: Number(it.price),
      originalPrice: it.originalPrice != null ? Number(it.originalPrice) : null,
    })),
  });
}
