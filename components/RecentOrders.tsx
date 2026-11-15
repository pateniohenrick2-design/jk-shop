'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCustomer } from '@/lib/useCustomer';
import type { RecentOrder } from '@/app/api/my-orders/recent/route';

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

// Home page: "Your recent orders" — one card per thing the logged-in customer ordered recently.
// Tapping a card opens that game with the same category + item already selected.
export default function RecentOrders() {
  const { user, loading } = useCustomer();
  const [recent, setRecent] = useState<RecentOrder[] | null>(null);

  useEffect(() => {
    if (!user) { setRecent(null); return; }
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch('/api/my-orders/recent', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json();
        if (alive && Array.isArray(body.recent)) setRecent(body.recent);
      } catch { /* the section just stays hidden */ }
    })();
    return () => { alive = false; };
  }, [user]);

  if (loading || !user || !recent || recent.length === 0) return null;

  return (
    <section className="section recent-section" aria-labelledby="recent-title">
      <div className="recent-head">
        <h2 id="recent-title">
          <span className="recent-ico" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" />
            </svg>
          </span>
          YOUR RECENT ORDERS
        </h2>
        <Link href="/my-orders" className="recent-all">See all →</Link>
      </div>
      <p className="sub">Order the same thing again in one tap.</p>

      <div className="recent-row">
        {recent.map((r) => {
          const params = new URLSearchParams({ category: r.categoryId });
          if (r.itemId) params.set('item', r.itemId);
          return (
            <Link
              key={r.key}
              href={`/game/${r.gameSlug}?${params.toString()}`}
              className="recent-card"
              data-loading-label={`Loading ${r.gameName}…`}
            >
              <div className="recent-art">
                <img src={`/games/${r.gameSlug}.png`} alt="" />
                {r.icon && <img className="recent-item-icon" src={r.icon} alt="" />}
              </div>
              <div className="recent-body">
                <strong className="recent-item">{r.item}</strong>
                <span className="recent-game">{r.gameName} · {r.category}</span>
                <span className="recent-meta">
                  {r.price != null ? <b>₱{r.price.toLocaleString('en-PH')}</b> : <span>See price</span>}
                  <span className="recent-when">{ago(r.lastOrderedAt)}</span>
                </span>
                <span className="recent-cta">Order again →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
