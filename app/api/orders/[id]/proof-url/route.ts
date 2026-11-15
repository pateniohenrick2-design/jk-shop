import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminSession } from '@/lib/adminSession';
import { splitProofs } from '@/lib/proofs';

// GET /api/orders/:id/proof-url → { url, urls } — viewable links for every proof-of-payment image
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id }, select: { proofOfPaymentUrl: true } });
  const proofs = splitProofs(order?.proofOfPaymentUrl);
  if (proofs.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  const urls: string[] = [];
  for (const p of proofs) {
    if (p.startsWith('http://') || p.startsWith('https://')) {
      // R2 links go through our own /api/image-proxy (some ISPs block .r2.dev)
      if (r2PublicUrl && p.startsWith(r2PublicUrl)) {
        urls.push(`/api/image-proxy?key=${encodeURIComponent(p.slice(r2PublicUrl.length + 1))}`);
      } else {
        urls.push(p);
      }
      continue;
    }
    // Old orders (before the R2 migration) store a Supabase Storage path — sign it (5 min)
    const { data } = await supabaseAdmin.storage.from('proof-of-payments').createSignedUrl(p, 60 * 5);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  if (urls.length === 0) return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 });
  return NextResponse.json({ url: urls[0], urls });
}
