import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';
import AccountClient from './AccountClient';

export const revalidate = 0;

export default async function AdminAccountPage() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  return <AccountClient username={session?.username ?? ''} role={session?.role ?? 'staff'} />;
}
