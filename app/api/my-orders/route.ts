import { NextRequest, NextResponse } from 'next/server';
import { getCustomer } from '@/lib/customerAuth';
import { ordersForCustomer } from '@/lib/customerOrders';

// GET /api/my-orders?page=&q= — one page (10) of the logged-in customer's orders (needs "Authorization: Bearer <token>")
export async function GET(req: NextRequest) {
  const customer = await getCustomer(req);
  if (!customer) return NextResponse.json({ error: 'Please log in to see your orders.' }, { status: 401 });

  try {
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10) || 1;
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const result = await ordersForCustomer(customer.id, customer.email, { page, q });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    // Shows up in Vercel → Logs with the real reason; the customer gets a readable message
    console.error('[my-orders] failed for', customer.id, err);
    return NextResponse.json(
      { error: 'Could not load your orders right now (server error). Please tap Refresh in a moment.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
