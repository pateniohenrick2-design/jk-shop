import { prisma } from '@/lib/prisma';
import PricelistsClient from './PricelistsClient';

export const revalidate = 0;

export default async function AdminPricelistsPage() {
  const games = await prisma.game.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      categories: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          group: true,
          sortOrder: true,
          items: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const serialized = games.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    categories: g.categories.map((c) => ({
      id: c.id,
      name: c.name,
      group: c.group as 'main' | 'others',
      sortOrder: c.sortOrder,
      items: c.items.map((it) => ({
        id: it.id,
        name: it.name,
        price: Number(it.price),
        originalPrice: it.originalPrice != null ? Number(it.originalPrice) : null,
        status: it.status as 'available' | 'sold_out',
        notes: it.notes,
        sortOrder: it.sortOrder,
      })),
    })),
  }));

  return <PricelistsClient initialGames={serialized} />;
}