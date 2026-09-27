'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/pricelists', label: 'Pricelists' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/events', label: 'Events' },
];

export default function AdminNav({ username, role }: { username: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">JK Shop Admin</div>
      <nav>
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`admin-nav-link ${active ? 'active' : ''}`}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="admin-sidebar-footer">
        <div className="admin-user">
          <strong>{username}</strong>
          <span>{role === 'super_admin' ? 'Super Admin' : 'Staff'}</span>
        </div>
        <button className="admin-logout-btn" onClick={handleLogout}>Sign Out</button>
      </div>
    </aside>
  );
}