import { prisma } from '@/lib/prisma';
import EventsClient from './EventsClient';

export const revalidate = 0;

export default async function AdminEventsPage() {
  const category = await prisma.category.findFirst({
    where: { name: 'Event Skin Gifting', game: { slug: 'mlbb' } },
  });

  if (!category) {
    return <p className="field-hint">Event Skin Gifting category not found — check your seed data.</p>;
  }

  const events = await prisma.event.findMany({
    where: { categoryId: category.id },
    include: { heroes: { include: { schedule: true } } },
    orderBy: { startDate: 'desc' },
  });

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
      })),
    })),
  }));

  return <EventsClient initialEvents={serialized} categoryId={category.id} />;
}