import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';
import { uploadPaymentImage, serializePaymentMethod } from '@/lib/paymentMethods';

// POST — add a new payment method.
// Form fields: name, accountName, accountNumber, isActive ("true"/"false"), qrImage (file), logoImage (file)
export async function POST(req: NextRequest) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fd = await req.formData();
  const name = (fd.get('name') as string | null)?.trim() ?? '';
  const accountName = (fd.get('accountName') as string | null)?.trim() ?? '';
  const accountNumber = (fd.get('accountNumber') as string | null)?.trim() ?? '';
  if (!name || !accountName || !accountNumber) {
    return NextResponse.json({ error: 'Name, account name and account number are required.' }, { status: 400 });
  }

  const existing = await prisma.paymentMethod.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
  if (existing) return NextResponse.json({ error: `A payment method named "${existing.name}" already exists.` }, { status: 409 });

  const qr = await uploadPaymentImage(fd.get('qrImage') as File | null, 'payments-qr', 'QR image');
  if (qr.error) return NextResponse.json({ error: qr.error }, { status: 400 });
  const logo = await uploadPaymentImage(fd.get('logoImage') as File | null, 'payments-logo', 'Logo');
  if (logo.error) return NextResponse.json({ error: logo.error }, { status: 400 });

  const created = await prisma.paymentMethod.create({
    data: {
      name,
      accountName,
      accountNumber,
      qrImageUrl: qr.key ?? null,
      logoUrl: logo.key ?? null,
      isActive: (fd.get('isActive') as string | null) !== 'false',
    },
  });
  return NextResponse.json(serializePaymentMethod(created), { status: 201 });
}
