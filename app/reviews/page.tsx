import { prisma } from '@/lib/prisma';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ReviewsSection from '@/components/ReviewsSection';

export const revalidate = 60;
export const metadata = { title: 'Reviews · JK SHOP', description: 'What JK Shop customers say about their orders' };

// All customer reviews, with a game filter
export default async function ReviewsPage() {
  // (empty list if the reviews table isn't there yet, so a build never fails on it)
  const games = await prisma.game.findMany({
    where: { isActive: true, reviews: { some: { hidden: false } } },
    select: { slug: true, name: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  }).catch(() => [] as { slug: string; name: string }[]);
  return (
    <>
      <Header />
      <main className="section rv-page">
        <p className="rv-page-sub">Real reviews from customers who completed an order with us.</p>
        <ReviewsSection games={games} title="Customer reviews" />
      </main>
      <Footer />
    </>
  );
}
