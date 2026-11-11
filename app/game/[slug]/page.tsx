import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import GameOrderForm from './GameOrderForm';

export const revalidate = 60;

// Pre-build every game page at deploy time so clicks are served from cache
// (and fully prefetched by the home page links) instead of hitting the DB first.
// Games added later still work — they're built on first visit, then cached.
export async function generateStaticParams() {
  const games = await prisma.game.findMany({ where: { isActive: true }, select: { slug: true } });
  return games.map((g) => ({ slug: g.slug }));
}

export default async function GamePage({ params }: { params: { slug: string } }) {
  // Both queries are independent, so run them at the same time.
  const [game, paymentMethods] = await Promise.all([
    prisma.game.findUnique({
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
    }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ]);

  if (!game) return notFound();

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
          heroes: e.heroes.map((h) => ({ id: h.id, heroName: h.heroName, price: Number(h.price), imageUrl: h.imageUrl })),
          schedule: e.schedule.map((s) => ({
            id: s.id,
            heroId: s.heroId,
            phaseName: s.phaseName,
            startDate: s.startDate.toISOString(),
            endDate: s.endDate.toISOString(),
            price: Number(s.price),
            // Checked in the browser too, so a cached page still flips to SOLD OUT on time
            soldOutAt: s.soldOutAt ? s.soldOutAt.toISOString() : null,
          })),
        })),
    })),
  };

  const serializedPayments = paymentMethods.map((p) => ({
    id: p.id,
    name: p.name,
    accountName: p.accountName,
    accountNumber: p.accountNumber,
    qrImageUrl: p.qrImageUrl,
    logoUrl: p.logoUrl,
  }));

  return (
    <>
      <Header />
      <GameOrderForm game={serializedGame} paymentMethods={serializedPayments} />
      <Footer />
    </>
  );
}