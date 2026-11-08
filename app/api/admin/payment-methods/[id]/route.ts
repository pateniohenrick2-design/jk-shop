import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';
import { uploadPaymentImage, serializePaymentMethod } from '@/lib/paymentMethods';

async function requireAdmin() {
  const token = cookies().get(COOKIE_NAME)?.value;
  return token ? await verifySessionToken(token) : null;
}

// PATCH — update details, QR image and/or logo.
// Form fields: name, accountName, accountNumber, isActive, qrImage (file), removeQr ("true"), logoImage (file), removeLogo ("true")
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fd = await req.formData();
  const data: {
    name?: string; accountName?: string; accountNumber?: string; isActive?: boolean;
    qrImageUrl?: string | null; logoUrl?: string | null;
  } = {};

  const name = (fd.get('name') as string | null)?.trim();
  const accountName = (fd.get('accountName') as string | null)?.trim();
  const accountNumber = (fd.get('accountNumber') as string | null)?.trim();
  const isActive = fd.get('isActive') as string | null;
  if (name) {
    const clash = await prisma.paymentMethod.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, NOT: { id: params.id } },
    });
    if (clash) return NextResponse.json({ error: `A payment method named "${clash.name}" already exists.` }, { status: 409 });
    data.name = name;
  }
  if (accountName) data.accountName = accountName;
  if (accountNumber) data.accountNumber = accountNumber;
  if (isActive !== null) data.isActive = isActive === 'true';

  const qr = await uploadPaymentImage(fd.get('qrImage') as File | null, 'payments-qr', 'QR image');
  if (qr.error) return NextResponse.json({ error: qr.error }, { status: 400 });
  if (qr.key) data.qrImageUrl = qr.key;
  else if (fd.get('removeQr') === 'true') data.qrImageUrl = null;

  const logo = await uploadPaymentImage(fd.get('logoImage') as File | null, 'payments-logo', 'Logo');
  if (logo.error) return NextResponse.json({ error: logo.error }, { status: 400 });
  if (logo.key) data.logoUrl = logo.key;
  else if (fd.get('removeLogo') === 'true') data.logoUrl = null;

  try {
    const updated = await prisma.paymentMethod.update({ where: { id: params.id }, data });
    return NextResponse.json(serializePaymentMethod(updated));
  } catch {
    return NextResponse.json({ error: 'Payment method not found.' }, { status: 404 });
  }
}

// DELETE — only for methods with no orders; otherwise hide it instead (keeps order history intact)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orders = await prisma.order.count({ where: { paymentMethodId: params.id } });
  if (orders > 0) {
    return NextResponse.json(
      { error: `Can't delete — ${orders} order(s) used this payment method. Turn off "Shown at checkout" to hide it instead.` },
      { status: 409 },
    );
  }
  try {
    await prisma.paymentMethod.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Payment method not found.' }, { status: 404 });
  }
}
