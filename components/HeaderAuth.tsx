'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCustomer, customerDisplayName } from '@/lib/useCustomer';

// Top-right of the header: "Log in" button, or the signed-in customer's menu.
export default function HeaderAuth() {
  const { user, loading } = useCustomer();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (loading) return <span className="auth-placeholder" aria-hidden />;

  if (!user) {
    const next = pathname && pathname !== '/login' ? `?next=${encodeURIComponent(pathname)}` : '';
    return (
      <Link href={`/login${next}`} className="auth-login-btn">
        Log in
      </Link>
    );
  }

  const name = customerDisplayName(user);
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="auth-menu" ref={menuRef}>
      <button className="auth-avatar-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span>{name.charAt(0).toUpperCase()}</span>}
        <span className="auth-name">{name}</span>
      </button>
      {open && (
        <div className="auth-dropdown" role="menu">
          <div className="auth-dropdown-head">
            <strong>{name}</strong>
            <span>{user.email}</span>
          </div>
          <button
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await supabase.auth.signOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
