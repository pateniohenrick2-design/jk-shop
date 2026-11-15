import { prisma } from '@/lib/prisma';
import { ORDERS_PAGE_SIZE, adminOrderInclude, buildOrderWhere, readOrderFilters, serializeAdminOrder } from '@/lib/adminOrders';
import OrdersClient from './OrdersClient';

export const revalidate = 0;

// One page (10 orders) at a time; search, game and status filters run in the database.
// The filters live in the URL (?q=&game=&status=&page=) so Back/Refresh keep your place.
export default async function AdminOrdersPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { page: requested, ...filters } = readOrderFilters(searchParams);
  const where = await buildOrderWhere(filters);

  const [total, games] = await Promise.all([
    prisma.order.count({ where }),
    prisma.game.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const page = Math.min(requested, pages);

  const orders = await prisma.order.findMany({
    where,
    include: adminOrderInclude,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * ORDERS_PAGE_SIZE,
    take: ORDERS_PAGE_SIZE,
  });

  return (
    <OrdersClient
      initialOrders={orders.map(serializeAdminOrder)}
      games={games}
      loadedAt={new Date().toISOString()}
      total={total}
      page={page}
      pageSize={ORDERS_PAGE_SIZE}
      filters={filters}
    />
  );
}
