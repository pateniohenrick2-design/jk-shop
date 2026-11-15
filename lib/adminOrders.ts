import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isOrderStatus } from '@/lib/orderStatus';

export const ORDERS_PAGE_SIZE = 10;

export type OrderFilters = { q: string; game: string; status: string };

export function readOrderFilters(sp: Record<string, string | string[] | undefined>): OrderFilters & { page: number } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const page = Math.max(1, parseInt(one(sp.page), 10) || 1);
  return { q: one(sp.q).trim().slice(0, 100), game: one(sp.game) || 'all', status: one(sp.status) || 'all', page };
}

// Search + filters for the admin Orders page and its CSV export, done by the database
// so only one page of orders is ever loaded.
export async function buildOrderWhere(f: OrderFilters): Promise<Prisma.OrderWhereInput> {
  const where: Prisma.OrderWhereInput = {};
  if (f.game && f.game !== 'all') where.gameId = f.game;
  if (f.status && f.status !== 'all' && isOrderStatus(f.status)) where.status = f.status as OrderStatus;
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    // Account details (User ID, IGN, ...) live in a JSON column: search its text
    const byAccount = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Order" WHERE "accountFields"::text ILIKE ${like} ORDER BY "createdAt" DESC LIMIT 500`;
    where.OR = [
      { orderCode: { contains: f.q, mode: 'insensitive' } },
      { facebookName: { contains: f.q, mode: 'insensitive' } },
      { email: { contains: f.q, mode: 'insensitive' } },
      ...(byAccount.length ? [{ id: { in: byAccount.map((r) => r.id) } }] : []),
    ];
  }
  return where;
}

export const adminOrderInclude = {
  game: { select: { id: true, name: true } },
  category: { include: { fields: { orderBy: { sortOrder: 'asc' as const } } } },
  item: { select: { name: true } },
  event: { select: { name: true } },
  paymentMethod: { select: { name: true } },
  internalNotes: {
    include: { admin: { select: { username: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.OrderInclude;

type AdminOrder = Prisma.OrderGetPayload<{ include: typeof adminOrderInclude }>;

export function serializeAdminOrder(o: AdminOrder) {
  return {
    id: o.id,
    orderCode: o.orderCode,
    gameId: o.gameId,
    gameName: o.game.name,
    categoryName: o.category.name,
    itemName: o.item?.name ?? null,
    eventName: o.event?.name ?? null,
    accountFields: o.category.fields.map((f) => ({
      label: f.label,
      value: (o.accountFields as Record<string, string> | null)?.[f.id] ?? '',
    })),
    quantity: o.quantity,
    unitPrice: Number(o.unitPrice),
    totalPrice: Number(o.totalPrice),
    paymentMethodName: o.paymentMethod.name,
    proofOfPaymentUrl: o.proofOfPaymentUrl,
    facebookName: o.facebookName,
    email: o.email,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    notes: o.internalNotes.map((n) => ({
      id: n.id,
      text: n.noteText,
      admin: n.admin.username,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}
