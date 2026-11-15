import { prisma } from '@/lib/prisma';
import { splitImages } from '@/lib/reviews';
import { viewableImage, reviewSummary } from '@/lib/reviewsServer';
import ReviewsAdminClient from './ReviewsAdminClient';

export const revalidate = 0;
const PAGE_SIZE = 20;

// Every review (hidden ones too), newest first. ?filter=hidden|low|photos  ?page=
export default async function AdminReviewsPage({ searchParams }: { searchParams: { filter?: string; page?: string } }) {
  const filter = searchParams.filter ?? 'all';
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const where =
    filter === 'hidden' ? { hidden: true }
      : filter === 'low' ? { rating: { lte: 2 } }
      : filter === 'photos' ? { imageUrls: { not: null } }
      : {};

  const [total, rows, summary, hiddenCount] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { game: { select: { name: true } }, order: { select: { orderCode: true, email: true } } },
    }),
    reviewSummary(),
    prisma.review.count({ where: { hidden: true } }),
  ]);

  const reviews = rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    rating: r.rating,
    comment: r.comment,
    images: splitImages(r.imageUrls).map(viewableImage),
    itemName: r.itemName,
    gameName: r.game.name,
    orderCode: r.order.orderCode ?? '',
    email: r.order.email ?? '',
    hidden: r.hidden,
    adminReply: r.adminReply,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <ReviewsAdminClient
      reviews={reviews}
      filter={filter}
      page={page}
      pages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
      total={total}
      summary={summary}
      hiddenCount={hiddenCount}
    />
  );
}
