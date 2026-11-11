'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Loading feedback that stays on the CURRENT page until the next page is fully ready:
//  - a thin progress bar at the top of the screen
//  - a centered "Loading …" overlay (after a short delay, so quick page changes don't flash)
//  - the clicked link gets data-loading="true" (game cards show a spinner from it)
// The next page then appears in one go — no half-loaded placeholder page in between.
// A link can set data-loading-label="Loading Mobile Legends…" for the overlay text.
export default function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [label, setLabel] = useState('Loading…');
  const [progress, setProgress] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const overlayRef = useRef<ReturnType<typeof setTimeout>>();
  const safetyRef = useRef<ReturnType<typeof setTimeout>>();
  const linkRef = useRef<HTMLAnchorElement | null>(null);

  function clearLink() {
    linkRef.current?.removeAttribute('data-loading');
    linkRef.current = null;
  }

  function stopAll() {
    clearInterval(tickRef.current);
    clearTimeout(overlayRef.current);
    clearTimeout(safetyRef.current);
    clearLink();
    setOverlay(false);
  }

  // Start on clicks of same-site links that go to a different page
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new-tab clicks etc.
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / #anchor

      stopAll();
      linkRef.current = a;
      a.setAttribute('data-loading', 'true');
      setLabel(a.getAttribute('data-loading-label') || 'Loading…');
      setActive(true);
      setProgress(8);
      // Creep towards 90% (never "finishes" on its own — the new page finishes it)
      tickRef.current = setInterval(() => setProgress((p) => (p < 90 ? p + (90 - p) * 0.08 : p)), 200);
      overlayRef.current = setTimeout(() => setOverlay(true), 150);
      // Never leave it stuck if the navigation is cancelled or fails
      safetyRef.current = setTimeout(() => { stopAll(); setActive(false); setProgress(0); }, 20000);
    }
    // Capture phase: runs BEFORE Next's <Link> handler, which calls preventDefault()
    // (in the normal bubble phase every Link click would look "already handled" and be skipped)
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // New page shown → finish the bar, drop the overlay
  useEffect(() => {
    stopAll();
    setProgress((p) => (p > 0 ? 100 : 0));
    const t = setTimeout(() => { setActive(false); setProgress(0); }, 300);
    return () => clearTimeout(t);
  }, [pathname, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clearInterval(tickRef.current); clearTimeout(overlayRef.current); clearTimeout(safetyRef.current); }, []);

  return (
    <>
      <div className={`nav-progress ${active ? 'on' : ''}`} aria-hidden>
        <div className="nav-progress-bar" style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <div className={`nav-overlay ${overlay ? 'on' : ''}`} role="status" aria-live="polite" aria-hidden={!overlay}>
        <div className="nav-overlay-card">
          <span className="spinner" aria-hidden />
          {overlay ? label : ''}
        </div>
      </div>
    </>
  );
}
