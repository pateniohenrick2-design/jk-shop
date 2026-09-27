import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import GameOrderForm from './GameOrderForm';

export const revalidate = 60;

export default async function GamePage({ params }: { params: { slug: string } }) {
  const game = await prisma.game.findUnique({
    where: { slug: params.slug },
    include: {
      categories: {
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          fields: { orderBy: { sortOrder: 'asc' } },
          events: {
            include: { heroes: true, schedule: { orderBy: { startDate: 'asc' } } },
            orderBy: { startDate: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!game) return notFound();

  const paymentMethods = await prisma.paymentMethod.findMany({ where: { isActive: true } });

  // Prisma's Decimal type can't cross the server->client component boundary as-is,
  // so plain numbers/objects are built here before handing off to the client form.
  const serializedGame = {
    id: game.id,
    name: game.name,
    slug: game.slug,
    description: game.description,
    categories: game.categories.map((c) => ({
      id: c.id,
      name: c.name,
      group: c.group,
      fields: c.fields.map((f) => ({ id: f.id, label: f.label, helperText: f.helperText })),
      items: c.items.map((it) => ({
        id: it.id,
        name: it.name,
        price: Number(it.price),
        status: it.status,
      })),
      events: c.events
        .filter((e) => e.endDate >= new Date()) // auto-hide once the schedule has passed
        .map((e) => ({
          id: e.id,
          name: e.name,
          basePrice: Number(e.basePrice),
          endDate: e.endDate.toISOString(),
          heroes: e.heroes.map((h) => ({ id: h.id, heroName: h.heroName, price: Number(h.price) })),
          schedule: e.schedule.map((s) => ({
            id: s.id,
            phaseName: s.phaseName,
            startDate: s.startDate.toISOString(),
            endDate: s.endDate.toISOString(),
            price: Number(s.price),
          })),
        })),
    })),
  };

  const serializedPayments = paymentMethods.map((p) => ({
    id: p.id,
    name: p.name,
    accountName: p.accountName,
    accountNumber: p.accountNumber,
  }));

  return (
    <>
      <Header />
      <GameOrderForm game={serializedGame} paymentMethods={serializedPayments} />
      <Footer />
    </>
  );
}