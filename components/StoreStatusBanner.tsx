'use client';

import { usePathname } from 'next/navigation';
import { useStoreSettings } from '@/lib/useStoreSettings';

// Thin notice across the top of every customer page while the admin has the store set to Closed.
export default function StoreStatusBanner() {
  const pathname = usePathname() || '';
  const s = useStoreSettings();
  if (!s || s.isOpen || pathname.startsWith('/admin')) return null;
  return (
    <div className="store-closed-banner" role="status">
      <span className="store-closed-icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </span>
      <span className="store-closed-text">
        <strong>We&apos;re closed</strong>
        <span className="store-closed-msg">{s.closedMessage}</span>
      </span>
    </div>
  );
}
