import { NextRequest, NextResponse } from 'next/server';
import { getCustomer } from '@/lib/customerAuth';
import { ordersForCustomer } from '@/lib/customerOrders';

// GET /api/my-orders — the logged-in customer's orders (needs "Authorization: Bearer <token>")
export async function GET(req: NextRequest) {
  const customer = await getCustomer(req);
  if (!customer) return NextResponse.json({ error: 'Please log in to see your orders.' }, { status: 401 });

  try {
    const orders = await ordersForCustomer(customer.id, customer.email);
    return NextResponse.json({ orders }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    // Shows up in Vercel → Logs with the real reason; the customer gets a readable message
    console.error('[my-orders] failed for', customer.id, err);
    return NextResponse.json(
      { error: 'Could not load your orders right now (server error). Please tap Refresh in a moment.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
