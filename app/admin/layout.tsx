import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';
import AdminNav from './AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <div className="admin-shell">
      {session && <AdminNav username={session.username} role={session.role} />}
      <main className="admin-main">{children}</main>
    </div>
  );
}