import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCustomer } from '@/lib/customerAuth';
import { itemIcon } from '@/lib/itemIcons';

export type RecentOrder = {
  key: string;
  gameSlug: string;
  gameName: string;
  categoryId: string;
  category: string;
  itemId: string | null;
  item: string;
  price: number | null; // today's price (null for events / removed items)
  icon: string | null;
  lastOrderedAt: string;
  orderCode: string;
};

// GET /api/my-orders/recent — the logged-in customer's most recent DIFFERENT things they ordered
// (same game + item only once), for the home page "Order again" row.
export async function GET(req: NextRequest) {
  const customer = await getCustomer(req);
  if (!customer) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { customerId: customer.id },
        ...(customer.email ? [{ email: { equals: customer.email, mode: 'insensitive' as const } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: {
      orderCode: true,
      createdAt: true,
      categoryId: true,
      itemId: true,
      game: { select: { slug: true, name: true, isActive: true } },
      category: { select: { name: true } },
      item: { select: { name: true, price: true, status: true, iconUrl: true } },
      event: { select: { name: true } },
    },
  });

  const seen = new Set<string>();
  const recent: RecentOrder[] = [];
  for (const o of orders) {
    if (!o.game.isActive) continue;
    const item = o.item?.name ?? o.event?.name ?? o.category.name;
    const key = `${o.game.slug}|${o.itemId ?? o.categoryId}|${item}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const uploaded = o.item?.iconUrl;
    recent.push({
      key,
      gameSlug: o.game.slug,
      gameName: o.game.name,
      categoryId: o.categoryId,
      category: o.category.name,
      itemId: o.item && o.item.status !== 'sold_out' ? o.itemId : null,
      item,
      price: o.item && o.item.status !== 'sold_out' ? Number(o.item.price) : null,
      icon: uploaded === '' ? null : uploaded ? null : itemIcon(o.game.slug, item), // uploaded icons are shown via the game page
      lastOrderedAt: o.createdAt.toISOString(),
      orderCode: o.orderCode ?? '',
    });
    if (recent.length >= 8) break;
  }

  return NextResponse.json({ recent }, { headers: { 'Cache-Control': 'no-store' } });
}
