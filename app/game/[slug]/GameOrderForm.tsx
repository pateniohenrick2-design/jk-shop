'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { compressImage } from '@/lib/compressImage';
import { supabase } from '@/lib/supabase';
import { useCustomer } from '@/lib/useCustomer';
import PaymentLogo from '@/components/PaymentLogo';
import { normalizeLabel, savedAccountName, type SavedAccount } from '@/lib/savedAccounts';
import { isSoldOut } from '@/lib/manilaDate';

type Item = { id: string; name: string; price: number; status: string };
type Field = { id: string; label: string; helperText?: string | null };
type Hero = { id: string; heroName: string; price: number; imageUrl: string | null };
type SchedulePhase = { id: string; heroId: string; phaseName: string; startDate: string; endDate: string; price: number; soldOutAt: string | null };
type EventDef = { id: string; name: string; basePrice: number; endDate: string; heroes: Hero[]; schedule: SchedulePhase[] };
type Category = { id: string; name: string; group: string; fields: Field[]; items: Item[]; events: EventDef[] };
type Game = { id: string; name: string; slug: string; description?: string | null; categories: Category[] };
type PaymentMethod = { id: string; name: string; accountName: string; accountNumber: string; qrImageUrl: string | null; logoUrl: string | null };

// Lucide icons (copy, qr-code, check), inlined
const iconProps = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'btn-icon',
} as const;

function CopyIcon() {
  return (
    <svg {...iconProps}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg {...iconProps}>
      <rect width="5" height="5" x="3" y="3" rx="1" />
      <rect width="5" height="5" x="16" y="3" rx="1" />
      <rect width="5" height="5" x="3" y="16" rx="1" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <path d="M21 21v.01" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <path d="M3 12h.01" />
      <path d="M12 3h.01" />
      <path d="M12 16v.01" />
      <path d="M16 12h1" />
      <path d="M21 12v.01" />
      <path d="M12 21v-1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function GameOrderForm({ game, paymentMethods }: { game: Game; paymentMethods: PaymentMethod[] }) {
  const mainCats = game.categories.filter((c) => c.group === 'main');
  const otherCats = game.categories.filter((c) => c.group === 'others');

  const [categoryId, setCategoryId] = useState(mainCats[0]?.id ?? otherCats[0]?.id ?? '');
  const category = useMemo(
    () => game.categories.find((c) => c.id === categoryId) ?? game.categories[0],
    [categoryId, game.categories]
  );

  const [itemId, setItemId] = useState<string>('');
  const [itemsExpanded, setItemsExpanded] = useState(false); // long pricelists start at 10 rows
  const item = category?.items.find((it) => it.id === itemId);

  const [eventId, setEventId] = useState<string>('');
  const [heroId, setHeroId] = useState<string>('');
  const [phaseId, setPhaseId] = useState<string>('');
  const selectedEvent = category?.events.find((e) => e.id === eventId);
  const selectedHero = selectedEvent?.heroes.find((h) => h.id === heroId);
  // Each schedule phase belongs to one hero: only show the selected hero's phases
  const heroSchedule = selectedEvent && selectedHero ? selectedEvent.schedule.filter((s) => s.heroId === selectedHero.id) : [];
  // Admin-set "sold out on" dates: re-checked every minute so an open page flips on time
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const phaseSoldOut = (s: SchedulePhase) => isSoldOut(s.soldOutAt, now);
  // A hero with a delivery schedule is sold out once every one of its phases is
  const heroSoldOut = (ev: EventDef, heroIdToCheck: string) => {
    const phases = ev.schedule.filter((s) => s.heroId === heroIdToCheck);
    return phases.length > 0 && phases.every(phaseSoldOut);
  };
  const selectedPhase = heroSchedule.find((s) => s.id === phaseId && !phaseSoldOut(s));

  const [quantity, setQuantity] = useState(1);
  const [accountValues, setAccountValues] = useState<Record<string, string>>({});
  const [paymentId, setPaymentId] = useState<string>(paymentMethods[0]?.id ?? '');
  const [proofFileName, setProofFileName] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [qrPayment, setQrPayment] = useState<PaymentMethod | null>(null);
  const [copiedId, setCopiedId] = useState('');
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();
  async function copyNumber(p: PaymentMethod) {
    try {
      await navigator.clipboard.writeText(p.accountNumber.replace(/\s+/g, ''));
      setCopiedId(p.id);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedId(''), 1800);
    } catch { /* clipboard blocked — number is still visible to copy by hand */ }
  }
  const [facebookName, setFacebookName] = useState('');
  const [email, setEmail] = useState('');
  const { user: customer } = useCustomer();
  const router = useRouter();
  // Logged-in customers: use their verified account email (field becomes read-only)
  useEffect(() => {
    if (customer?.email) setEmail(customer.email);
  }, [customer?.email]);
  // Logged-in customers: account details from their past orders for this game, to fill in with one tap
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [savedKey, setSavedKey] = useState('');
  useEffect(() => {
    if (!customer) { setSavedAccounts([]); setSavedKey(''); return; }
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/saved-accounts?gameId=${encodeURIComponent(game.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || !active) return;
      const d: { accounts?: SavedAccount[]; facebookName?: string } = await res.json();
      const accounts = d.accounts ?? [];
      setSavedAccounts(accounts);
      if (accounts[0]) setSavedKey((k) => k || accounts[0].key); // auto-fill the most recent one
      const fb = d.facebookName;
      if (fb) setFacebookName((n) => (n.trim() ? n : fb));
    })().catch(() => { /* autofill is optional */ });
    return () => { active = false; };
  }, [customer?.id, game.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saved accounts that have at least one detail this category asks for
  const usableSaved = savedAccounts.filter((a) => category?.fields.some((f) => a.values[normalizeLabel(f.label)]));

  function applySaved(acc: SavedAccount, overwrite: boolean) {
    if (!category) return;
    setAccountValues((v) => {
      const next = { ...v };
      for (const f of category.fields) {
        const val = acc.values[normalizeLabel(f.label)];
        if (val && (overwrite || !next[f.id]?.trim())) next[f.id] = val;
      }
      return next;
    });
  }

  // Fill empty fields from the chosen saved account — also after switching category
  useEffect(() => {
    const acc = savedAccounts.find((a) => a.key === savedKey);
    if (acc) applySaved(acc, false);
  }, [savedKey, savedAccounts, category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saved account waiting for the customer to confirm removal in the modal
  const [removeTarget, setRemoveTarget] = useState<SavedAccount | null>(null);
  useEffect(() => {
    if (!removeTarget) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setRemoveTarget(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeTarget]);

  async function removeSaved(acc: SavedAccount) {
    setRemoveTarget(null);
    const prevAccounts = savedAccounts;
    const prevKey = savedKey;
    // Remove right away; put it back if the server call fails
    setSavedAccounts((list) => list.filter((a) => a.key !== acc.key));
    if (savedKey === acc.key) setSavedKey('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch('/api/saved-accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ gameId: game.id, key: acc.key }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSavedAccounts(prevAccounts);
      setSavedKey(prevKey);
      setResult({ ok: false, msg: 'Could not remove the saved account. Please try again.' });
    }
  }

  function savedMatches(acc: SavedAccount) {
    const relevant = (category?.fields ?? []).filter((f) => acc.values[normalizeLabel(f.label)]);
    return relevant.length > 0 && relevant.every((f) => (accountValues[f.id] ?? '').trim() === acc.values[normalizeLabel(f.label)]);
  }

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const orderPanelRef = useRef<HTMLDivElement>(null);
  const accountFieldRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const paymentPanelRef = useRef<HTMLDivElement>(null);
  const proofPanelRef = useRef<HTMLDivElement>(null);
  const facebookRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  function goTo(el: HTMLElement | null) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el instanceof HTMLInputElement) el.focus();
  }

  const eventUnitPrice = selectedPhase ? selectedPhase.price : selectedHero ? selectedHero.price : 0;
  const unitPrice = item ? item.price : eventUnitPrice;
  const total = unitPrice * quantity;

  const showCategoryStep = game.slug === 'mlbb';
  // Category → Order → Account → Quantity → Payment → Proof → Confirmation
  // (games without the category step start numbering at "Select Order")
  const offset = showCategoryStep ? 1 : 0;
  const stepCategory = 1;
  const stepOrder = 1 + offset;
  const stepAccount = 2 + offset;
  const stepQuantity = 3 + offset;
  const stepPayment = 4 + offset;
  const stepProof = 5 + offset;
  const stepConfirmation = 6 + offset;

  function selectCategory(id: string) {
    setCategoryId(id);
    setItemsExpanded(false);
    setItemId('');
    setEventId('');
    setHeroId('');
    setPhaseId('');
    setResult(null);
  }

  function selectEvent(id: string) {
    setEventId(id);
    setHeroId('');
    setPhaseId('');
  }

  // Proof of payment is compressed + uploaded in the background as soon as it's picked,
  // so Submit only has to wait for it if it hasn't finished yet.
  const proofUploadRef = useRef<{ file: File; promise: Promise<string> } | null>(null);

  function getProofUpload(file: File): Promise<string> {
    if (proofUploadRef.current?.file === file) return proofUploadRef.current.promise;
    const promise = (async () => {
      const compressed = await compressImage(file);
      const uploadForm = new FormData();
      uploadForm.append('file', compressed);
      uploadForm.append('folder', game.slug);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadForm });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to upload proof of payment. Please try again.');
      }
      const uploadData = await uploadRes.json();
      return uploadData.url as string; // full public R2 URL, stored directly
    })();
    promise.catch(() => { /* reported on Submit */ });
    proofUploadRef.current = { file, promise };
    return promise;
  }

  // Load the confirmation page ahead of time so the jump after Submit is instant
  useEffect(() => { router.prefetch('/order-success'); }, [router]);

  async function submitOrder() {
    if (!category) return;
    if (category.items.length > 0 && !item) {
      setResult({ ok: false, msg: 'Please select an item first.' });
      return goTo(orderPanelRef.current);
    }
    if (category.events.length > 0 && !selectedEvent) {
      setResult({ ok: false, msg: 'Please select an event first.' });
      return goTo(orderPanelRef.current);
    }
    if (category.events.length > 0 && selectedEvent && !selectedHero) {
      setResult({ ok: false, msg: 'Please select a hero skin first.' });
      return goTo(orderPanelRef.current);
    }
    if (category.events.length > 0 && selectedEvent && selectedHero && heroSchedule.length > 0 && !selectedPhase) {
      setResult({ ok: false, msg: 'Please select a delivery schedule first.' });
      return goTo(orderPanelRef.current);
    }
    for (const f of category.fields) {
      if (!accountValues[f.id]?.trim()) {
        setResult({ ok: false, msg: `Please fill in "${f.label}".` });
        return goTo(accountFieldRefs.current[f.id]);
      }
    }
    if (!paymentId) {
      setResult({ ok: false, msg: 'Please choose a payment method.' });
      return goTo(paymentPanelRef.current);
    }
    if (!proofFileName) {
      setResult({ ok: false, msg: 'Please attach your proof of payment.' });
      return goTo(proofPanelRef.current);
    }
    if (!facebookName.trim()) {
      setResult({ ok: false, msg: 'Please enter your Facebook account/name.' });
      return goTo(facebookRef.current);
    }
    if (!email.trim()) {
      setResult({ ok: false, msg: 'Please enter your email.' });
      return goTo(emailRef.current);
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setResult({ ok: false, msg: 'Please enter a valid email address.' });
      return goTo(emailRef.current);
    }

    setSubmitting(true);
    setResult(null);
    try {
      let proofPath: string | null = null;
      if (proofFile) {
        try {
          // Usually already finished: the upload starts as soon as the file is picked
          proofPath = await getProofUpload(proofFile);
        } catch (uploadErr) {
          proofUploadRef.current = null; // let the next Submit retry the upload
          setResult({
            ok: false,
            msg: uploadErr instanceof Error && uploadErr.message ? uploadErr.message : 'Failed to upload proof of payment. Please try again.',
          });
          setSubmitting(false);
          return;
        }
      }

      // Send the login token so the server can confirm the email is the customer's verified one
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          gameId: game.id,
          categoryId: category.id,
          itemId: item?.id ?? null,
          eventId: selectedEvent?.id ?? null,
          heroId: selectedHero?.id ?? null,
          phaseId: selectedPhase?.id ?? null,
          accountFields: accountValues,
          quantity,
          unitPrice,
          paymentMethodId: paymentId,
          proofOfPaymentUrl: proofPath,
          facebookName,
          email,
        }),
      });
      if (!res.ok) {
        // e.g. the delivery schedule sold out while the page was open
        const errData = await res.json().catch(() => ({}));
        if (res.status === 409 && errData.error) {
          setResult({ ok: false, msg: errData.error });
          setPhaseId('');
          goTo(orderPanelRef.current);
          return;
        }
        throw new Error('Server rejected the order.');
      }
      const data = await res.json();
      const orderCode: string = data.orderCode ?? data.id;
      // Hand the summary to the full-page confirmation (kept only in this browser tab)
      try {
        sessionStorage.setItem('jk:lastOrder', JSON.stringify({
          orderCode,
          game: game.name,
          category: category.name,
          item: item?.name || [selectedEvent?.name, selectedHero?.heroName].filter(Boolean).join(' – ') || category.name,
          phase: selectedPhase?.phaseName ?? null,
          quantity,
          total,
          paymentMethod: paymentMethods.find((p) => p.id === paymentId)?.name ?? '',
          email: customer?.email ?? email,
          loggedIn: !!customer,
        }));
      } catch { /* storage blocked — the page still works from the URL */ }
      router.push(`/order-success?code=${encodeURIComponent(orderCode)}`);
      return;
    } catch (e) {
      setResult({ ok: false, msg: 'Something went wrong submitting your order. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="order-wrap">
      {/* LEFT COLUMN */}
      <div className="order-col">
        <div className="panel game-banner step-banner">
          <img src={`/games/${game.slug}.png`} alt={game.name} />
          <div>
            <h1>{game.name}</h1>
            {game.description && <p>{game.description}</p>}
          </div>
        </div>

        {showCategoryStep && (
          <div className="panel step-category">
            <div className="panel-head"><span className="step-num">{stepCategory}</span><h2>Select Category</h2></div>
            <div className="cat-grid">
              {mainCats.map((c) => (
                <button key={c.id} className={`cat-btn ${categoryId === c.id ? 'active' : ''}`} onClick={() => selectCategory(c.id)}>
                  {c.name}
                </button>
              ))}
              {otherCats.length > 0 && (
                <select
                  className="others-sel"
                  value={otherCats.some((c) => c.id === categoryId) ? categoryId : ''}
                  onChange={(e) => e.target.value && selectCategory(e.target.value)}
                >
                  <option value="">Others — {otherCats.length} more categories</option>
                  {otherCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          </div>
        )}

        <div className="panel step-items" ref={orderPanelRef}>
          <div className="panel-head"><span className="step-num">{stepOrder}</span><h2>Select Order ({category?.name})</h2></div>
          {category && category.items.length > 0 && (
            <>
            {/* Collapsed: first 10 rows only (CSS hides the rest — 2 per row, 1 per row on tiny phones) */}
            <div className={`item-grid ${itemsExpanded ? '' : 'collapsed'}`}>
              {category.items.map((it) => (
                <button
                  key={it.id}
                  disabled={it.status === 'sold_out'}
                  className={`item-btn ${itemId === it.id ? 'active' : ''} ${it.status === 'sold_out' ? 'sold' : ''}`}
                  onClick={() => setItemId(it.id)}
                >
                  <span>{it.name}</span>
                  <span>{it.status === 'sold_out' ? 'SOLD OUT' : `₱${it.price}`}</span>
                </button>
              ))}
            </div>
            {category.items.length > 10 && (
              <button
                type="button"
                className={`item-toggle ${category.items.length <= 20 ? 'few' : ''}`}
                aria-expanded={itemsExpanded}
                onClick={() => {
                  if (itemsExpanded) orderPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setItemsExpanded((v) => !v);
                }}
              >
                {itemsExpanded ? 'Show less' : `Show all ${category.items.length} items`}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden className={itemsExpanded ? 'flip' : ''}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            )}
            </>
          )}

          {category && category.items.length === 0 && category.events.length > 0 && (
            <>
              <p className="field-hint">{category.events.length} event{category.events.length > 1 ? 's' : ''} running now — pick one to see its hero skins</p>
              <div className="event-tabs">
                {category.events.map((e) => (
                  <button key={e.id} className={`event-tab ${eventId === e.id ? 'active' : ''}`} onClick={() => selectEvent(e.id)}>
                    {e.name}
                    <span className="sub">Ends {new Date(e.endDate).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>

              {selectedEvent && selectedEvent.heroes.length > 0 && (
                <div className="hero-grid">
                  {selectedEvent.heroes.map((h) => {
                    const sold = heroSoldOut(selectedEvent, h.id);
                    return (
                    <button
                      key={h.id}
                      className={`hero-card ${heroId === h.id && !sold ? 'active' : ''} ${sold ? 'sold' : ''}`}
                      disabled={sold}
                      onClick={() => { setHeroId(h.id); setPhaseId(''); }}
                    >
                      {h.imageUrl && (
                        <img
                          src={`/api/image-proxy?key=${encodeURIComponent(h.imageUrl)}`}
                          alt={h.heroName}
                          className="hero-card-img"
                          loading="lazy"
                        />
                      )}
                      <div className="name">{h.heroName}</div>
                      <div className="price">{sold ? 'SOLD OUT' : `From ₱${h.price}`}</div>
                    </button>
                    );
                  })}
                </div>
              )}

              {selectedEvent && selectedHero && heroSchedule.length > 0 && !heroSoldOut(selectedEvent, selectedHero.id) && (
                <>
                  <p className="field-hint" style={{ marginTop: 4 }}>Delivery Schedule — {selectedHero.heroName} (price depends on when you order)</p>
                  <div className="schedule-grid">
                    {heroSchedule.map((s) => {
                      const sold = phaseSoldOut(s);
                      return (
                        <button
                          key={s.id}
                          className={`phase-btn ${phaseId === s.id && !sold ? 'active' : ''} ${sold ? 'sold' : ''}`}
                          disabled={sold}
                          onClick={() => setPhaseId(s.id)}
                        >
                          <span>
                            {s.phaseName}
                            <span className="range">{new Date(s.startDate).toLocaleDateString()} – {new Date(s.endDate).toLocaleDateString()}</span>
                          </span>
                          <span>{sold ? 'SOLD OUT' : `₱${s.price}`}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <p className="event-note">Pay as you order · first come first served · via gifting · 8-day friendship required · prices may change without notice · no rush · no cancellation · no refund</p>
            </>
          )}

          {category && category.items.length === 0 && category.events.length === 0 && (
            <p className="field-hint">No pricelist available yet for this category — check back soon.</p>
          )}
        </div>

        <div className="panel step-payment" ref={paymentPanelRef}>
          <div className="panel-head"><span className="step-num">{stepPayment}</span><h2>Choose Payment Method</h2></div>
          <div role="radiogroup" aria-label="Payment method">
          {paymentMethods.map((p) => {
            const active = paymentId === p.id;
            return (
              <div
                key={p.id}
                className={`pay-row-v2 ${active ? 'active' : ''}`}
                role="radio"
                aria-checked={active}
                tabIndex={0}
                onClick={() => setPaymentId(p.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPaymentId(p.id); } }}
              >
                <PaymentLogo name={p.name} logoUrl={p.logoUrl} />
                <div className="pay-info">
                  <span className="pay-name">{p.name}</span>
                  <span className="pay-account-name">{p.accountName}</span>
                  <span className="pay-account-number">{p.accountNumber}</span>
                </div>
                <span className="pay-radio" aria-hidden />
                <div className="pay-actions">
                  <button
                    type="button"
                    className="pay-copy-btn"
                    onClick={(e) => { e.stopPropagation(); setPaymentId(p.id); copyNumber(p); }}
                  >
                    {copiedId === p.id ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy number</>}
                  </button>
                  <button
                    type="button"
                    className="view-qr-btn"
                    onClick={(e) => { e.stopPropagation(); setQrPayment(p); }}
                  >
                    <QrIcon /> View QR
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {removeTarget && (
          <div className="qr-modal-overlay" onClick={() => setRemoveTarget(null)}>
            <div
              className="qr-modal remove-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="qr-modal-close" aria-label="Close" onClick={() => setRemoveTarget(null)}>✕</button>
              <h3 id="remove-modal-title">Remove saved account?</h3>
              <div className="remove-modal-details">
                {removeTarget.display.map((d) => (
                  <div key={d.label} className="remove-modal-row">
                    <span>{d.label}</span>
                    <strong>{d.value}</strong>
                  </div>
                ))}
              </div>
              <p className="field-hint">It won't show up for autofill anymore. Your past orders aren't affected.</p>
              <div className="remove-modal-actions">
                <button type="button" className="remove-modal-cancel" autoFocus onClick={() => setRemoveTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="remove-modal-confirm" onClick={() => removeSaved(removeTarget)}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {qrPayment && (
          <div className="qr-modal-overlay" onClick={() => setQrPayment(null)}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <button className="qr-modal-close" onClick={() => setQrPayment(null)}>✕</button>
              <h3>{qrPayment.name}</h3>
              {qrPayment.qrImageUrl ? (
                <img src={`/api/image-proxy?key=${encodeURIComponent(qrPayment.qrImageUrl)}`} alt={`${qrPayment.name} QR code`} />
              ) : (
                <p className="qr-missing">QR code not available yet. Please send your payment to the account number below.</p>
              )}
              <p className="field-hint">{qrPayment.accountName} · {qrPayment.accountNumber}</p>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN */}
      <div className="order-col">
        <div className="panel step-account">
          <div className="panel-head"><span className="step-num">{stepAccount}</span><h2>Account Details</h2></div>
          {usableSaved.length > 0 && (
            <div className="saved-accounts">
              <p className="field-hint">Your saved accounts — tap one to fill in the details</p>
              <div className="saved-chips">
                {usableSaved.map((a) => (
                  <span key={a.key} className={`saved-chip ${savedMatches(a) ? 'active' : ''}`}>
                    <button
                      type="button"
                      className="saved-chip-fill"
                      onClick={() => { setSavedKey(a.key); applySaved(a, true); }}
                      title={a.display.map((d) => `${d.label}: ${d.value}`).join('\n')}
                    >
                      {savedAccountName(a)}
                    </button>
                    <button
                      type="button"
                      className="saved-chip-x"
                      aria-label="Remove saved account"
                      title="Remove saved account"
                      onClick={() => setRemoveTarget(a)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className="saved-chip saved-chip-new"
                  onClick={() => {
                    setSavedKey('');
                    setAccountValues({});
                    const first = category?.fields[0];
                    if (first) accountFieldRefs.current[first.id]?.focus();
                  }}
                >
                  + New account
                </button>
              </div>
            </div>
          )}
          {(category?.fields ?? []).map((f) => (
            <div key={f.id}>
              <input
                ref={(el) => { accountFieldRefs.current[f.id] = el; }}
                className="field-input"
                placeholder={`${f.label} *`}
                value={accountValues[f.id] ?? ''}
                onChange={(e) => setAccountValues((v) => ({ ...v, [f.id]: e.target.value }))}
                required
              />
              {f.helperText && <p className="field-hint">{f.helperText}</p>}
            </div>
          ))}
          {(category?.fields.length ?? 0) > 0 && (customer ? (
            usableSaved.length === 0 && (
              <p className="field-hint">We'll remember these details so you can fill them in with one tap next time.</p>
            )
          ) : (
            <p className="field-hint">
              <Link href={`/login?next=${encodeURIComponent(`/game/${game.slug}`)}`} className="login-link">Log in</Link> to save your account details for next time
            </p>
          ))}
        </div>

        <div className="panel step-qty">
          <div className="panel-head"><span className="step-num">{stepQuantity}</span><h2>Order Quantity</h2></div>
          <div className="qty-row">
            <button className="qty-btn" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
            <div className="qty-val">{quantity}</div>
            <button className="qty-btn" onClick={() => setQuantity((q) => q + 1)}>+</button>
          </div>
          <div className="price-row"><span>Price</span><span>₱{total}</span></div>
        </div>

        <div className="panel step-proof" ref={proofPanelRef}>
          <div className="panel-head"><span className="step-num">{stepProof}</span><h2>Proof of Payment</h2></div>
          <label className={`upload-box${proofFileName ? ' upload-box-done' : ''}`}>
            <span className="upload-icon" aria-hidden>{proofFileName ? '✓' : '📎'}</span>
            <span className="upload-text">
              {proofFileName ? <strong>{proofFileName}</strong> : 'Attach your receipt or screenshot of payment'}
            </span>
            <span className="upload-btn">{proofFileName ? 'Change file' : 'Choose file'}</span>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setProofFile(f);
                setProofFileName(f?.name ?? '');
                if (f) getProofUpload(f); // start uploading now, in the background
              }}
            />
          </label>
          <p className="field-hint" style={{ color: '#e0c26a', marginTop: 8 }}>NO RECEIPT = NO PROCESS</p>
        </div>

        <div className="panel step-confirm">
          <div className="panel-head"><span className="step-num">{stepConfirmation}</span><h2>Order Confirmation</h2></div>
          <input ref={facebookRef} className="field-input" placeholder="Enter Facebook Account / Name *" value={facebookName} onChange={(e) => setFacebookName(e.target.value)} required />
          <p className="field-hint">So the seller can reach you if there's an issue with your order</p>
          {customer?.email ? (
            <>
              <input ref={emailRef} className="field-input field-input-locked" type="email" value={customer.email} readOnly aria-readonly />
              <p className="field-hint">✓ Verified email from your account. We'll send your receipt here.</p>
            </>
          ) : (
            <>
              <input ref={emailRef} className="field-input" type="email" placeholder="Enter Email *" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <p className="field-hint">
                We'll send your transaction receipt to this address ·{' '}
                <Link href={`/login?next=${encodeURIComponent(`/game/${game.slug}`)}`} className="login-link">Log in</Link> to fill this automatically
              </p>
            </>
          )}

          {result && (
            <div className={result.ok ? 'success-msg' : 'error-msg'}>
              {result.msg}
              {result.ok && (
                <>
                  {' '}
                  <Link href="/my-orders" className="login-link">
                    View it in My Orders →
                  </Link>
                </>
              )}
            </div>
          )}

          <button className="submit-btn" disabled={submitting} onClick={submitOrder}>
            {submitting ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
