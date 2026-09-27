import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { proofOfPaymentUrl: true },
  });

  if (!order || !order.proofOfPaymentUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // New orders (uploaded via R2) store a full public .r2.dev URL.
  // Some ISPs block .r2.dev directly, so we route the browser through
  // our own /api/image-proxy instead of returning the raw R2 link.
  if (order.proofOfPaymentUrl.startsWith('http://') || order.proofOfPaymentUrl.startsWith('https://')) {
    const r2PublicUrl = process.env.R2_PUBLIC_URL!;
    if (order.proofOfPaymentUrl.startsWith(r2PublicUrl)) {
      const key = order.proofOfPaymentUrl.slice(r2PublicUrl.length + 1); // strip base + leading slash
      return NextResponse.json({ url: `/api/image-proxy?key=${encodeURIComponent(key)}` });
    }
    // Some other full URL (not R2) — return as-is
    return NextResponse.json({ url: order.proofOfPaymentUrl });
  }

  // Old orders (uploaded before the R2 migration) still store a
  // Supabase Storage PATH — sign it as before.
  const { data, error } = await supabaseAdmin.storage
    .from('proof-of-payments') // <-- keep as your actual bucket name
    .createSignedUrl(order.proofOfPaymentUrl, 60 * 5); // 5 min expiry

  if (error || !data) {
    return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}