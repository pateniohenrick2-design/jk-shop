import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// What a customer is allowed to see about their own order — order details only.
// No status (the shop tracks that in the Google Sheet), proof links, internal notes or admin data.
export type CustomerOrder = {
  orderCode: string;
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

// All orders that belong to a logged-in customer: orders placed while logged in, plus
// earlier guest orders that used the same (now verified) email address.
export async function ordersForCustomer(customerId: string, email: string | undefined) {
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { customerId },
        ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
      ],
    },
    include: customerOrderInclude,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return orders.map(toCustomerOrder);
}
