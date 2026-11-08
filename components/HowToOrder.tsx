'use client';

import { useEffect, useRef, useState } from 'react';

// "How to order" button + centered modal. Hidden until clicked.
// Also opens automatically for old links to /#how-to-order.
export default function HowToOrder() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (window.location.hash === '#how-to-order') setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // no background scrolling while open
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  function close() {
    setOpen(false);
    if (window.location.hash === '#how-to-order') history.replaceState(null, '', window.location.pathname + window.location.search);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="btn-ghost" onClick={() => setOpen(true)} aria-haspopup="dialog">
        How to order
      </button>

      {open && (
        <div className="how-modal-overlay" onClick={close}>
          <div
            className="how-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button ref={closeRef} type="button" className="qr-modal-close" onClick={close} aria-label="Close">✕</button>
            <h2 id="how-modal-title">HOW TO ORDER</h2>
            <p className="sub">Every order is processed manually, so a few quick steps help us get it to you faster.</p>
            <ol className="how-steps">
              <li>
                <span className="how-num">1</span>
                <strong>Choose your game &amp; item</strong>
                <p>Enter your account details exactly as they appear in the game.</p>
              </li>
              <li>
                <span className="how-num">2</span>
                <strong>Pay, then upload your proof</strong>
                <p>Send payment to the account shown at checkout and attach the screenshot.</p>
              </li>
              <li>
                <span className="how-num">3</span>
                <strong>Submit &amp; save your Order ID</strong>
                <p>You’ll get an Order ID right away and a receipt by email.</p>
              </li>
              <li>
                <span className="how-num">4</span>
                <strong>We top up your account</strong>
                <p>Our team processes it by hand. Your order details are always saved in <a href="/my-orders">My Orders</a>.</p>
              </li>
            </ol>
            <div className="how-reminders">
              <strong>⚠️ Before you order</strong>
              <ul>
                <li>Double-check your User ID, Server and IGN. We can’t recover top-ups sent to a wrong account.</li>
                <li>Make sure you’re paying the exact account number shown at checkout.</li>
                <li>Orders without a payment screenshot can’t be processed.</li>
                <li>Need help? Message us on Facebook with your Order ID.</li>
              </ul>
            </div>
            <a href="#games" className="btn-primary how-modal-cta" onClick={() => setOpen(false)}>Browse Games →</a>
          </div>
        </div>
      )}
    </>
  );
}
