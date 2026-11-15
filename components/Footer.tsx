'use client';

import Link from 'next/link';
import { FOOTER_PAYMENTS } from '@/lib/siteConfig';
import { DEFAULT_STORE_SETTINGS } from '@/lib/storeSettings';
import { useStoreSettings } from '@/lib/useStoreSettings';

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export default function Footer() {
  // Links + open/closed status come from Admin → Store Settings
  const loaded = useStoreSettings();
  const s = loaded ?? DEFAULT_STORE_SETTINGS;
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <img src="/logo/jkshop-logo.png" alt="JK SHOP" className="footer-logo" />
          <p>Affordable game top-up, processed by a real seller.</p>
          <a href={s.contactUrl} target="_blank" rel="noopener noreferrer" className="footer-fb-btn">
            <FacebookIcon /> {s.contactLabel}
          </a>
        </div>

        <div className="footer-cols">
          <div>
            <h4>Shop</h4>
            <Link href="/">All Games</Link>
            <Link href="/my-orders">My Orders</Link>
            <Link href="/reviews">Reviews</Link>
            {/* plain <a>: on the home page it just changes the #hash, which opens the guide */}
            <a href="/#how-to-order">How to Order</a>
          </div>
          <div>
            <h4>Contact us</h4>
            {loaded && (
              <span className={`footer-store-status ${loaded.isOpen ? 'open' : 'closed'}`}>
                <span className={`store-dot ${loaded.isOpen ? 'open' : 'closed'}`} aria-hidden />
                {loaded.isOpen ? 'Open now' : 'Closed right now'}
              </span>
            )}
            <a href={s.contactUrl} target="_blank" rel="noopener noreferrer" className="footer-icon-link">
              <ChatIcon /> Message us
            </a>
            <span className="footer-icon-link footer-note">
              <ClockIcon /> {s.replyTime}
            </span>
          </div>
        </div>
      </div>

      <div className="footer-pay">
        <span className="footer-pay-label">We accept</span>
        <ul className="footer-pay-list">
          {FOOTER_PAYMENTS.map((p) => (
            <li key={p.name} title={p.name}>
              <img src={p.logo} alt={p.name} loading="lazy" />
            </li>
          ))}
        </ul>
      </div>

      <div className="footer-bottom">© {new Date().getFullYear()} JK SHOP · Not affiliated with any game publisher.</div>
    </footer>
  );
}
