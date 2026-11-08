import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HowToOrder from '@/components/HowToOrder';

// Refresh the game list at most every 60s (same as the game pages)
export const revalidate = 60;

// Server component — fetches directly from Postgres via Prisma.
export default async function HomePage() {
  // Only games customers can actually order: at least one active category with
  // pricelist items, or an Event Skin Gifting event that hasn't ended yet.
  const games = await prisma.game.findMany({
    where: {
      isActive: true,
      categories: {
        some: {
          isActive: true,
          OR: [{ items: { some: {} } }, { events: { some: { endDate: { gte: new Date() } } } }],
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], // same order as the admin's drag-and-drop
  });

  return (
    <>
      <Header />

      <section className="hero">
        <p className="eyebrow">AFFORDABLE GAME TOP-UP · PROCESSED BY A REAL SELLER</p>
        <h1>Game credits at friendly prices, topped up by hand</h1>
        <p>
          Pick your game, pay with GCash, Maya or bank transfer, and send your proof of payment. We check every order
          ourselves and load it straight to your account, usually within minutes during store hours.
        </p>
        <div className="hero-actions">
          <a href="#games" className="btn-primary">Browse Games →</a>
          <HowToOrder />
        </div>
        <ul className="hero-points">
          <li>✓ Seller-verified orders</li>
          <li>✓ Order ID + email receipt</li>
          <li>✓ Find your orders anytime</li>
        </ul>
      </section>

      <section id="games" className="section">
        <h2>GAME OFFERS</h2>
        <p className="sub">Browse the latest top-up options across popular titles and discover quick, secure ways to get back into the game.</p>

        <div className="game-grid">
          {games.map((g) => (
            <Link key={g.id} href={`/game/${g.slug}`} className="game-card">
              {/* Drop matching images in /public/games/<slug>.png */}
              <img className="game-icon" src={`/games/${g.slug}.png`} alt={g.name} />
              <p>{g.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}
