'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';

type LastOrder = {
  orderCode: string;
  game: string;
  category: string;
  item: string;
  phase: string | null;
  quantity: number;
  total: number;
  paymentMethod: string;
  email: string;
  loggedIn: boolean;
};

const REDIRECT_SECONDS = 15;
const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

function SuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get('code') ?? '';
  const [order, setOrder] = useState<LastOrder | null>(null);
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('jk:lastOrder') || 'null') as LastOrder | null;
      if (saved && (!code || saved.orderCode === code)) setOrder(saved);
    } catch { /* ignore */ }
  }, [code]);

  // Count down, then go back to the home page (unless the customer paused it)
  useEffect(() => {
    if (paused) return;
    if (seconds <= 0) {
      router.push('/');
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, paused, router]);

  const orderCode = order?.orderCode || code;

  function copy() {
    navigator.clipboard?.writeText(orderCode).then(() => {
      setCopied(true);
      setPaused(true); // they're doing something — don't whisk them away
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  return (
    <main className="os-wrap">
      <div className="os-card">
        <div className="os-check" aria-hidden>
          <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg>
        </div>
        <h1>Order placed!</h1>
        <p className="os-sub">Thank you! We received your order and payment proof. We’ll process it as soon as possible.</p>

        {orderCode && (
          <div className="os-code-block">
            <span>Your Order ID</span>
            <button className="os-code" onClick={copy} title="Copy Order ID">
              {orderCode}
              <em>{copied ? 'Copied!' : 'Copy'}</em>
            </button>
          </div>
        )}

        {order && (
          <dl className="os-summary">
            <div><dt>Item</dt><dd>{order.item}{order.phase ? ` (${order.phase})` : ''}{order.quantity > 1 ? ` × ${order.quantity}` : ''}</dd></div>
            <div><dt>Game</dt><dd>{order.game} · {order.category}</dd></div>
            <div><dt>Paid via</dt><dd>{order.paymentMethod}</dd></div>
            <div className="os-total"><dt>Total</dt><dd>{peso(order.total)}</dd></div>
          </dl>
        )}

        {order?.email && (
          <p className="os-email">📧 A receipt was sent to <strong>{order.email}</strong>. Check your spam folder if you don’t see it.</p>
        )}

        <div className="os-actions">
          <Link href="/" className="submit-btn os-primary">Back to Home</Link>
          <Link href="/my-orders" className="os-secondary">{order?.loggedIn ? 'View My Orders' : 'Find this order later'}</Link>
        </div>

        <p className="os-redirect" aria-live="polite">
          {paused ? (
            <>Auto-redirect stopped. <button className="login-link" onClick={() => { setPaused(false); setSeconds(5); }}>Resume</button></>
          ) : (
            <>Going back to the home page in {seconds}s · <button className="login-link" onClick={() => setPaused(true)}>Stay on this page</button></>
          )}
        </p>
      </div>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<main className="os-wrap" />}>
        <SuccessInner />
      </Suspense>
    </>
  );
}
