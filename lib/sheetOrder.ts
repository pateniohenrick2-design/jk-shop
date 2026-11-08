import { prisma } from '@/lib/prisma';
import type { SheetOrder } from '@/lib/gsheet';

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

// Builds the Google Sheet row for an order from the database.
// heroId/phaseId: Event Skin Gifting choices (not stored on the order). origin: site URL fallback for proof links.
export async function buildSheetOrder(
  orderId: string,
  opts: { heroId?: string | null; phaseId?: string | null; origin?: string } = {},
): Promise<SheetOrder> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      game: true,
      category: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      item: true,
      event: true,
      paymentMethod: true,
    },
  });

  // accountFields is keyed by form field id → turn into { label: value }
  const raw = (order.accountFields ?? {}) as Record<string, string>;
  const fields: Record<string, string> = {};
  for (const f of order.category.fields) {
    const v = raw[f.id] ?? raw[String(f.sortOrder)];
    if (v != null && v !== '') fields[f.label] = String(v);
  }
  const pick = (re: RegExp) => Object.entries(fields).find(([label]) => re.test(label))?.[1] ?? '';

  // Event Skin Gifting: hero + delivery phase aren't stored on the order, so they come from the request
  const hero = opts.heroId ? await prisma.eventHero.findUnique({ where: { id: String(opts.heroId) } }) : null;
  const phase = opts.phaseId ? await prisma.eventSchedule.findUnique({ where: { id: String(opts.phaseId) } }) : null;

  const unitPrice = Number(order.unitPrice);
  const totalPrice = Number(order.totalPrice);
  let item: string;
  let orderDetails: string;
  if (order.item) {
    item = order.item.name;
    const orig = order.item.originalPrice != null ? Number(order.item.originalPrice) : null;
    orderDetails = `${item} – ${peso(unitPrice)}${orig && orig !== unitPrice ? ` (was ${peso(orig)})` : ''}`;
  } else {
    item = [order.event?.name, hero?.heroName].filter(Boolean).join(' – ') || order.category.name;
    orderDetails = `${hero?.heroName ?? item}${phase ? ` (${phase.phaseName})` : ''} – ${peso(unitPrice)}`;
  }

  // Proof link the shop owner can open even where *.r2.dev is blocked: route it through our proxy
  let proofUrl = order.proofOfPaymentUrl ?? '';
  const r2Public = process.env.R2_PUBLIC_URL;
  if (proofUrl && r2Public && proofUrl.startsWith(r2Public)) {
    const site = (process.env.SITE_URL || opts.origin || '').replace(/\/$/, '');
    proofUrl = `${site}/api/image-proxy?key=${encodeURIComponent(proofUrl.slice(r2Public.length + 1))}`;
  }

  return {
    orderId: order.id,
    orderCode: order.orderCode ?? order.id,
    createdAt: order.createdAt.toISOString(),
    game: order.game.name,
    gameSlug: order.game.slug,
    category: order.category.name,
    item,
    orderDetails,
    quantity: order.quantity,
    unitPrice,
    totalPrice,
    userId: pick(/user\s*id|uid|riot|username/i),
    serverId: pick(/server/i),
    ign: pick(/ign|display name/i),
    fields,
    paymentMethod: order.paymentMethod.name,
    proofUrl,
    facebookName: order.facebookName ?? '',
    email: order.email ?? '',
    eventName: order.event?.name,
    heroName: hero?.heroName,
    phaseName: phase?.phaseName,
  };
}
