import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Server component — fetches directly from Postgres via Prisma at request time.
export default async function HomePage() {
  const games = await prisma.game.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <>
      <Header />

      <section className="hero">
        <p className="eyebrow">FAST &amp; SECURE GAME TOP-UP</p>
        <h1>Instant diamonds, credits &amp; in-game items for your favorite games</h1>
        <p>Top up safely, get instant delivery, and explore curated offers across the games you play every day.</p>
        <a href="#games" className="btn-primary">Browse Games →</a>
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
