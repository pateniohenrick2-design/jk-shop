import { prisma } from '@/lib/prisma';
import EventsClient from './EventsClient';
import { toManilaDateString } from '@/lib/manilaDate';

export const revalidate = 0;

export default async function AdminEventsPage() {
  // Both at the same time: events are matched through their category instead of waiting for its id
  const categoryWhere = { name: 'Event Skin Gifting', game: { slug: 'mlbb' } };
  const [category, events] = await Promise.all([
    prisma.category.findFirst({ where: categoryWhere, select: { id: true } }),
    prisma.event.findMany({
      where: { category: categoryWhere },
      include: { heroes: { include: { schedule: true } } },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  if (!category) {
    return <p className="field-hint">Event Skin Gifting category not found — check your seed data.</p>;
  }

  const serialized = events.map((e) => ({
    id: e.id,
    name: e.name,
    startDate: e.startDate.toISOString().slice(0, 10),
    endDate: e.endDate.toISOString().slice(0, 10),
    heroes: e.heroes.map((h) => ({
      heroName: h.heroName,
      price: Number(h.price),
      imageUrl: h.imageUrl,
      schedule: h.schedule.map((s) => ({
        phaseName: s.phaseName,
        startDate: s.startDate.toISOString().slice(0, 10),
        endDate: s.endDate.toISOString().slice(0, 10),
        price: Number(s.price),
        soldOutOn: toManilaDateString(s.soldOutAt),
      })),
    })),
  }));

  return <EventsClient initialEvents={serialized} categoryId={category.id} />;
}