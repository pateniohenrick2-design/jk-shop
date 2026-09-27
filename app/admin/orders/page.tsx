import { prisma } from '@/lib/prisma';
import OrdersClient from './OrdersClient';

export const revalidate = 0;

export default async function AdminOrdersPage() {
  const [orders, games] = await Promise.all([
    prisma.order.findMany({
      include: {
        game: { select: { id: true, name: true } },
        category: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
        item: { select: { name: true } },
        event: { select: { name: true } },
        paymentMethod: { select: { name: true } },
        internalNotes: {
          include: { admin: { select: { username: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.game.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const serialized = orders.map((o) => ({
    id: o.id,
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
  }));

  return <OrdersClient initialOrders={serialized} games={games} />;
}