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

  // If proofOfPaymentUrl is a storage PATH (not already a full URL),
  // generate a signed URL from the private bucket:
  const { data, error } = await supabaseAdmin.storage
    .from('proof-of-payments') // <-- replace with your actual bucket name
    .createSignedUrl(order.proofOfPaymentUrl, 60 * 5); // 5 min expiry

  if (error || !data) {
    return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}