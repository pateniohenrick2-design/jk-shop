import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HowToOrder from '@/components/HowToOrder';
import RecentOrders from '@/components/RecentOrders';
import BrowseGamesButton from '@/components/BrowseGamesButton';
import { publicReviewSelect, ratingsByGame, toPublicReview } from '@/lib/reviewsServer';
import { Stars } from '@/components/ReviewModal';

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

  // Reviews: average per game card + a few recent good reviews (with a message) for "What customers say"
  const [ratings, topRows] = await Promise.all([
    ratingsByGame().catch(() => ({} as Record<string, { average: number; count: number }>)),
    prisma.review.findMany({
      where: { hidden: false, rating: { gte: 4 }, comment: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: publicReviewSelect,
    }).catch(() => []),
  ]);
  const topReviews = topRows.map(toPublicReview);

  return (
    <>
      <Header />

      <section className="hero">
        <div className="hero-content">
        <p className="eyebrow">AFFORDABLE GAME TOP-UP · PROCESSED BY A REAL SELLER</p>
        <h1>Game credits at friendly prices, topped up by hand</h1>
        <p>
          Pick your game, pay with GCash, Maya or bank transfer, and send your proof of payment. We process every order
          ourselves and load it straight to your account, usually within minutes during store hours.
        </p>
        <div className="hero-actions">
          <BrowseGamesButton />
          <HowToOrder />
        </div>
        <ul className="hero-points">
          <li>✓ Seller-verified orders</li>
          <li>✓ Order ID + email receipt</li>
          <li>✓ Find your orders anytime</li>
        </ul>
        </div>
        <img src="/logo/jk-logo.png" alt="JK" className="hero-logo" />
      </section>

      {/* Logged-in customers: their recent orders, one tap to order again */}
      <RecentOrders />

      <section id="games" className="section">
        <h2>GAME OFFERS</h2>
        <p className="sub">Browse the latest top-up options across popular titles and discover quick, secure ways to get back into the game.</p>

        <div className="game-grid">
          {games.map((g) => (
            <Link key={g.id} href={`/game/${g.slug}`} className="game-card" data-loading-label={`Loading ${g.name}…`}>
              {/* Drop matching images in /public/games/<slug>.png */}
              <img className="game-icon" src={`/games/${g.slug}.png`} alt={g.name} />
              <p>{g.name}</p>
              {ratings[g.id] && (
                <span className="game-card-rating" aria-label={`Rated ${ratings[g.id].average} out of 5`}>
                  ★ {ratings[g.id].average.toFixed(1)} <span>({ratings[g.id].count})</span>
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {topReviews.length > 0 && (
        <section className="section home-reviews" aria-labelledby="home-reviews-title">
          <div className="recent-head">
            <h2 id="home-reviews-title">WHAT CUSTOMERS SAY</h2>
            <Link href="/reviews" className="recent-all">See all reviews →</Link>
          </div>
          <div className="recent-row home-reviews-row">
            {topReviews.map((r) => (
              <Link key={r.id} href={`/game/${r.gameSlug}#reviews`} className="home-review">
                <div className="home-review-top">
                  <span className="rv-avatar" aria-hidden>{r.displayName[0]?.toUpperCase()}</span>
                  <div>
                    <strong>{r.displayName}</strong>
                    <Stars value={r.rating} size={13} />
                  </div>
                </div>
                <p className="home-review-text">{r.comment}</p>
                {r.images[0] && <img className="home-review-img" src={r.images[0]} alt="" loading="lazy" />}
                <span className="home-review-item">✓ {r.itemName} · {r.gameName}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </>
  );
}
