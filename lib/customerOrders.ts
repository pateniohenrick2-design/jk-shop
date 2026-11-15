import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { OrderStatusValue } from '@/lib/orderStatus';

// What a customer is allowed to see about their own order: details + status
// (status is synced from the Google Sheet). No proof links, internal notes or admin data.
export type CustomerOrder = {
  orderCode: string;
  status: OrderStatusValue;
  createdAt: string;
  game: string;
  category: string;
  item: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethod: string;
  account: { label: string; value: string }[];
};

export const customerOrderInclude = {
  game: { select: { name: true } },
  category: { select: { name: true, fields: { orderBy: { sortOrder: 'asc' as const }, select: { id: true, label: true } } } },
  item: { select: { name: true } },
  event: { select: { name: true } },
  paymentMethod: { select: { name: true } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof customerOrderInclude }>;

export function toCustomerOrder(o: OrderWithRelations): CustomerOrder {
  const raw = (o.accountFields ?? {}) as Record<string, string>;
  return {
    orderCode: o.orderCode ?? o.id.slice(-8).toUpperCase(),
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    game: o.game.name,
    category: o.category.name,
    item: o.item?.name ?? o.event?.name ?? o.category.name,
    quantity: o.quantity,
    unitPrice: Number(o.unitPrice),
    totalPrice: Number(o.totalPrice),
    paymentMethod: o.paymentMethod.name,
    account: o.category.fields
      .map((f) => ({ label: f.label.replace(/^Enter\s+/i, ''), value: String(raw[f.id] ?? '') }))
      .filter((f) => f.value),
  };
}

export const MY_ORDERS_PAGE_SIZE = 10;

// Orders that belong to a logged-in customer: orders placed while logged in, plus
// earlier guest orders that used the same (now verified) email address.
// One page at a time (newest first), optionally searched by Order ID / item / game.
export async function ordersForCustomer(
  customerId: string,
  email: string | undefined,
  opts: { page?: number; q?: string } = {},
) {
  const q = opts.q?.trim().slice(0, 100);
  const where: Prisma.OrderWhereInput = {
    OR: [
      { customerId },
      ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
    ],
    ...(q
      ? {
          AND: [{
            OR: [
              { orderCode: { contains: q, mode: 'insensitive' as const } },
              { item: { name: { contains: q, mode: 'insensitive' as const } } },
              { event: { name: { contains: q, mode: 'insensitive' as const } } },
              { game: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          }],
        }
      : {}),
  };
  const total = await prisma.order.count({ where });
  const pages = Math.max(1, Math.ceil(total / MY_ORDERS_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page ?? 1), pages);
  const orders = await prisma.order.findMany({
    where,
    include: customerOrderInclude,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * MY_ORDERS_PAGE_SIZE,
    take: MY_ORDERS_PAGE_SIZE,
  });
  return { orders: orders.map(toCustomerOrder), total, page, pages, pageSize: MY_ORDERS_PAGE_SIZE };
}
