import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

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
          <a href="#how-to-order" className="btn-ghost">How to order</a>
        </div>
        <ul className="hero-points">
          <li>✓ Seller-verified orders</li>
          <li>✓ Order ID + email receipt</li>
          <li>✓ Find your orders anytime</li>
        </ul>
      </section>

      <section id="how-to-order" className="section how-section">
        <h2>HOW TO ORDER</h2>
        <p className="sub">Every order is processed manually, so a few quick steps help us get it to you faster.</p>
        <ol className="how-steps">
          <li>
            <span className="how-num">1</span>
            <strong>Choose your game &amp; item</strong>
            <p>Enter your account details exactly as they appear in the game.</p>
          </li>
          <li>
            <span className="how-num">2</span>
            <strong>Pay, then upload your proof</strong>
            <p>Send payment to the account shown at checkout and attach the screenshot.</p>
          </li>
          <li>
            <span className="how-num">3</span>
            <strong>Submit &amp; save your Order ID</strong>
            <p>You’ll get an Order ID right away and a receipt by email.</p>
          </li>
          <li>
            <span className="how-num">4</span>
            <strong>We top up your account</strong>
            <p>Our team processes it by hand. Your order details are always saved in <a href="/my-orders">My Orders</a>.</p>
          </li>
        </ol>
        <div className="how-reminders">
          <strong>⚠️ Before you order</strong>
          <ul>
            <li>Double-check your User ID, Server and IGN. We can’t recover top-ups sent to a wrong account.</li>
            <li>Make sure you’re paying the exact account number shown at checkout.</li>
            <li>Orders without a payment screenshot can’t be processed.</li>
            <li>Need help? Message us on Facebook with your Order ID.</li>
          </ul>
        </div>
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
