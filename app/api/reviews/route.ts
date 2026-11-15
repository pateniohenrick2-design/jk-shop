import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCustomer } from '@/lib/customerAuth';
import { MAX_REVIEW_COMMENT, MAX_REVIEW_IMAGES, canReview, publicName } from '@/lib/reviews';
import { publicReviewSelect, reviewSummary, toPublicReview } from '@/lib/reviewsServer';

const PAGE_SIZE = 10;

// GET /api/reviews?game=<slug>&page=1&photos=1 — public: visible reviews, newest first, + summary
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const slug = sp.get('game');
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
  const photosOnly = sp.get('photos') === '1';

  const game = slug ? await prisma.game.findUnique({ where: { slug }, select: { id: true } }) : null;
  if (slug && !game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  const where = { hidden: false, ...(game ? { gameId: game.id } : {}), ...(photosOnly ? { imageUrls: { not: null } } : {}) };
  const [total, rows, summary] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: publicReviewSelect }),
    reviewSummary(game?.id),
  ]);
  return NextResponse.json(
    { reviews: rows.map(toPublicReview), total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), summary },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } },
  );
}

// POST /api/reviews — logged-in customer writes or updates the review of one of THEIR completed orders
// Body: { orderCode, rating 1–5, comment?, imageUrls?: string[] }
export async function POST(req: NextRequest) {
  const customer = await getCustomer(req);
  if (!customer) return NextResponse.json({ error: 'Please log in to leave a review.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const orderCode = String(body.orderCode ?? '').trim();
  const rating = Math.round(Number(body.rating));
  if (!orderCode) return NextResponse.json({ error: 'Missing order.' }, { status: 400 });
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: 'Please choose 1 to 5 stars.' }, { status: 400 });
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, MAX_REVIEW_COMMENT) : '';
  const r2 = process.env.R2_PUBLIC_URL;
  const images: string[] = (Array.isArray(body.imageUrls) ? body.imageUrls : [])
    .filter((u: unknown): u is string => typeof u === 'string' && /^https:\/\//i.test(u) && (!r2 || u.startsWith(r2)))
    .slice(0, MAX_REVIEW_IMAGES);

  // The order must belong to this customer (placed while logged in, or with their verified email)
  const order = await prisma.order.findFirst({
    where: {
      orderCode,
      OR: [{ customerId: customer.id }, ...(customer.email ? [{ email: { equals: customer.email, mode: 'insensitive' as const } }] : [])],
    },
    select: { id: true, status: true, gameId: true, item: { select: { name: true } }, event: { select: { name: true } }, category: { select: { name: true } } },
  });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (!canReview(order.status)) return NextResponse.json({ error: 'You can review this order once it is completed.' }, { status: 409 });

  const data = {
    rating,
    comment: comment || null,
    imageUrls: images.length ? images.join('\n') : null,
    displayName: publicName(customer.user_metadata?.full_name as string | undefined, customer.email),
  };
  const review = await prisma.review.upsert({
    where: { orderId: order.id },
    create: {
      ...data,
      orderId: order.id,
      gameId: order.gameId,
      customerId: customer.id,
      itemName: order.item?.name ?? order.event?.name ?? order.category.name,
    },
    update: data,
    select: { id: true, rating: true, comment: true, imageUrls: true },
  });
  return NextResponse.json({ ok: true, review });
}

// DELETE /api/reviews?orderCode=... — customer removes their own review
export async function DELETE(req: NextRequest) {
  const customer = await getCustomer(req);
  if (!customer) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  const orderCode = req.nextUrl.searchParams.get('orderCode') ?? '';
  const res = await prisma.review.deleteMany({ where: { customerId: customer.id, order: { orderCode } } });
  return NextResponse.json({ ok: true, deleted: res.count });
}
