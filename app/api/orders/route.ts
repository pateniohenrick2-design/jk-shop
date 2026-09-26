import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/orders?game=&status= — used by the admin Orders view
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get('game');
  const status = searchParams.get('status');

  const orders = await prisma.order.findMany({
    where: {
      ...(game ? { game: { slug: game } } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: { game: true, category: true, item: true, paymentMethod: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}

// POST /api/orders — used by the customer "Submit Order" step
export async function POST(req: NextRequest) {
  const body = await req.json();

  const order = await prisma.order.create({
    data: {
      gameId: body.gameId,
      categoryId: body.categoryId,
      itemId: body.itemId ?? null,
      eventId: body.eventId ?? null,
      accountFields: body.accountFields, // { userId, serverId, ign }
      quantity: body.quantity ?? 1,
      unitPrice: body.unitPrice,
      totalPrice: body.unitPrice * (body.quantity ?? 1),
      paymentMethodId: body.paymentMethodId,
      proofOfPaymentUrl: body.proofOfPaymentUrl,
      facebookName: body.facebookName,
      email: body.email,
    },
  });

  return NextResponse.json(order, { status: 201 });
}
