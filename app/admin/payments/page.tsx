import { prisma } from '@/lib/prisma';
import { serializePaymentMethod } from '@/lib/paymentMethods';
import PaymentsClient from './PaymentsClient';

export const revalidate = 0;

export default async function AdminPaymentsPage() {
  const methods = await prisma.paymentMethod.findMany({ orderBy: { name: 'asc' } });
  return <PaymentsClient initialMethods={methods.map(serializePaymentMethod)} />;
}
