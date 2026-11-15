import { prisma } from '@/lib/prisma';
import { withDefaults } from '@/lib/storeSettings';
import SettingsClient from './SettingsClient';

export const revalidate = 0;

export default async function AdminSettingsPage() {
  const row = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  return <SettingsClient initial={withDefaults(row)} saved={!!row} />;
}
