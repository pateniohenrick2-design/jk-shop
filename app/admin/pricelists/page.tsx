import { prisma } from '@/lib/prisma';
import PricelistsClient from './PricelistsClient';

export const revalidate = 0;

export default async function AdminPricelistsPage() {
  const games = await prisma.game.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      categories: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          group: true,
          sortOrder: true,
          items: { orderBy: { sortOrder: 'asc' } },
          // Event Skin Gifting: events are managed on the Events page; shown read-only here
          events: {
            orderBy: { startDate: 'desc' },
            select: {
              id: true, name: true, startDate: true, endDate: true,
              heroes: {
                select: {
                  id: true, heroName: true, price: true, imageUrl: true,
                  schedule: { orderBy: { startDate: 'asc' }, select: { id: true, phaseName: true, startDate: true, endDate: true, price: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const serialized = games.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    sortOrder: g.sortOrder,
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
      events: c.events.map((e) => ({
        id: e.id,
        name: e.name,
        startDate: e.startDate.toISOString().slice(0, 10),
        endDate: e.endDate.toISOString().slice(0, 10),
        heroes: e.heroes.map((h) => ({
          id: h.id,
          heroName: h.heroName,
          price: Number(h.price),
          imageUrl: h.imageUrl,
          schedule: h.schedule.map((s) => ({
            id: s.id,
            phaseName: s.phaseName,
            startDate: s.startDate.toISOString().slice(0, 10),
            endDate: s.endDate.toISOString().slice(0, 10),
            price: Number(s.price),
          })),
        })),
      })),
    })),
  }));

  return <PricelistsClient initialGames={serialized} />;
}