import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { splitImages, type PublicReview, type ReviewSummary } from '@/lib/reviews';

// R2 public links are blocked by some ISPs → serve them through our own /api/image-proxy
export function viewableImage(url: string): string {
  const r2 = process.env.R2_PUBLIC_URL;
  if (r2 && url.startsWith(r2)) return `/api/image-proxy?key=${encodeURIComponent(url.slice(r2.length + 1))}`;
  return url;
}

export const publicReviewSelect = {
  id: true, displayName: true, rating: true, comment: true, imageUrls: true, itemName: true,
  adminReply: true, createdAt: true, game: { select: { name: true, slug: true } },
} satisfies Prisma.ReviewSelect;

type Row = Prisma.ReviewGetPayload<{ select: typeof publicReviewSelect }>;

export function toPublicReview(r: Row): PublicReview {
  return {
    id: r.id,
    displayName: r.displayName,
    rating: r.rating,
    comment: r.comment,
    images: splitImages(r.imageUrls).map(viewableImage),
    itemName: r.itemName,
    gameName: r.game.name,
    gameSlug: r.game.slug,
    adminReply: r.adminReply,
    createdAt: r.createdAt.toISOString(),
  };
}

// Average + star breakdown of the visible reviews (one game, or all)
export async function reviewSummary(gameId?: string): Promise<ReviewSummary> {
  const rows = await prisma.review.groupBy({
    by: ['rating'],
    where: { hidden: false, ...(gameId ? { gameId } : {}) },
    _count: { _all: true },
  });
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReviewSummary['counts'];
  let total = 0;
  let sum = 0;
  for (const r of rows) {
    const k = Math.min(5, Math.max(1, r.rating)) as 1 | 2 | 3 | 4 | 5;
    counts[k] += r._count._all;
    total += r._count._all;
    sum += r.rating * r._count._all;
  }
  return { average: total ? Math.round((sum / total) * 10) / 10 : 0, count: total, counts };
}

// Average stars per game (home page cards)
export async function ratingsByGame(): Promise<Record<string, { average: number; count: number }>> {
  const rows = await prisma.review.groupBy({ by: ['gameId'], where: { hidden: false }, _avg: { rating: true }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.gameId, { average: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count._all }]));
}
