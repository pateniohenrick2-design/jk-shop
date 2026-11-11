import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { sendOrderToSheet } from '@/lib/gsheet';
import { buildSheetOrder } from '@/lib/sheetOrder';
import { nextOrderCode } from '@/lib/orderCode';
import { getCustomer } from '@/lib/customerAuth';
import { customerOrderInclude, toCustomerOrder } from '@/lib/customerOrders';
import { renderReceipt } from '@/lib/receiptEmail';
import { sendMail } from '@/lib/mailer';

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

  // Event delivery schedule that the admin marked sold out (the page may have been open since before)
  if (body.phaseId) {
    const phase = await prisma.eventSchedule.findUnique({ where: { id: String(body.phaseId) }, select: { soldOutAt: true, phaseName: true } });
    if (phase?.soldOutAt && phase.soldOutAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: `Sorry, the "${phase.phaseName}" delivery schedule is sold out. Please pick another schedule.` },
        { status: 409 },
      );
    }
  }

  // Logged-in customer: link the order to their account and trust their verified email
  const customer = await getCustomer(req);
  const email: string | null = customer?.email ?? body.email ?? null;

  const order = await prisma.$transaction(async (tx) => tx.order.create({
    data: {
      orderCode: await nextOrderCode(tx, body.categoryId),
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
      email,
      customerId: customer?.id ?? null,
    },
  }));

  // After saving: mirror to the Google Sheet and email the receipt, in parallel, in the BACKGROUND.
  // The customer gets their response right away; waitUntil keeps the Vercel function alive until
  // both finish. Neither can fail the order (errors are only logged).
  waitUntil(Promise.allSettled([
    (async () => {
      try {
        await sendOrderToSheet(await buildSheetOrder(order.id, { heroId: body.heroId, phaseId: body.phaseId, origin: req.nextUrl.origin }));
      } catch (err) {
        console.error('[gsheet] could not build sheet row for order', order.id, err);
      }
    })(),
    (async () => {
      if (!email) return;
      try {
        const full = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: customerOrderInclude });
        const receipt = renderReceipt(toCustomerOrder(full), {
          customerName: (customer?.user_metadata?.full_name as string | undefined) || order.facebookName,
          siteUrl: process.env.SITE_URL || req.nextUrl.origin,
        });
        await sendMail({ to: email, ...receipt });
      } catch (err) {
        console.error('[mail] could not send receipt for order', order.id, err);
      }
    })(),
  ]));

  return NextResponse.json(order, { status: 201 });
}
