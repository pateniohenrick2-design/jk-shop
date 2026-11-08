import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { customerOrderInclude, toCustomerOrder } from '@/lib/customerOrders';

// POST /api/track-order { orderCode, email } — guest lookup of a single order.
// Both must match, so nobody can look up someone else's order by guessing IDs.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const orderCode = String(body.orderCode ?? '').trim().toUpperCase();
  const email = String(body.email ?? '').trim();
  if (!orderCode || !email) {
    return NextResponse.json({ error: 'Enter your Order ID and the email you used.' }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { orderCode, email: { equals: email, mode: 'insensitive' } },
    include: customerOrderInclude,
  });
  if (!order) {
    // Same message whether the ID or the email is wrong — don't reveal which
    return NextResponse.json({ error: "We couldn't find an order with that Order ID and email." }, { status: 404 });
  }
  return NextResponse.json({ order: toCustomerOrder(order) }, { headers: { 'Cache-Control': 'no-store' } });
}
