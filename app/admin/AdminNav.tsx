'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/pricelists', label: 'Pricelists' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/payments', label: 'Payment Methods' },
  { href: '/admin/settings', label: 'Store Settings' },
  { href: '/admin/account', label: 'Account' },
];

// Desktop: fixed sidebar. Phones/tablets: a top bar with a ☰ button that slides the same menu in.
export default function AdminNav({ username, role }: { username: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = NAV_ITEMS.find((i) => pathname.startsWith(i.href));

  // Close the menu after navigating, and with Esc
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <>
      <header className="admin-mobilebar">
        <button
          type="button"
          className="admin-menu-btn"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="admin-mobilebar-title">{current?.label ?? 'JK Shop Admin'}</span>
      </header>

      {open && <div className="admin-backdrop" onClick={() => setOpen(false)} aria-hidden />}

      <aside id="admin-sidebar" className={`admin-sidebar${open ? ' open' : ''}`}>
        <div className="admin-sidebar-brand">
          JK Shop Admin
          <button type="button" className="admin-menu-close" aria-label="Close menu" onClick={() => setOpen(false)}>✕</button>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`admin-nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
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
    </>
  );
}
