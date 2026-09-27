'use client';

import { useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Item = { id: string; name: string; price: number; status: string };
type Field = { id: string; label: string; helperText?: string | null };
type Hero = { id: string; heroName: string; price: number };
type SchedulePhase = { id: string; phaseName: string; startDate: string; endDate: string; price: number };
type EventDef = { id: string; name: string; basePrice: number; endDate: string; heroes: Hero[]; schedule: SchedulePhase[] };
type Category = { id: string; name: string; group: string; fields: Field[]; items: Item[]; events: EventDef[] };
type Game = { id: string; name: string; slug: string; description?: string | null; categories: Category[] };
type PaymentMethod = { id: string; name: string; accountName: string; accountNumber: string };

export default function GameOrderForm({ game, paymentMethods }: { game: Game; paymentMethods: PaymentMethod[] }) {
  const mainCats = game.categories.filter((c) => c.group === 'main');
  const otherCats = game.categories.filter((c) => c.group === 'others');

  const [categoryId, setCategoryId] = useState(mainCats[0]?.id ?? otherCats[0]?.id ?? '');
  const category = useMemo(
    () => game.categories.find((c) => c.id === categoryId) ?? game.categories[0],
    [categoryId, game.categories]
  );

  const [itemId, setItemId] = useState<string>('');
  const item = category?.items.find((it) => it.id === itemId);

  const [eventId, setEventId] = useState<string>('');
  const [heroId, setHeroId] = useState<string>('');
  const [phaseId, setPhaseId] = useState<string>('');
  const selectedEvent = category?.events.find((e) => e.id === eventId);
  const selectedHero = selectedEvent?.heroes.find((h) => h.id === heroId);
  const selectedPhase = selectedEvent?.schedule.find((s) => s.id === phaseId);

  const [quantity, setQuantity] = useState(1);
  const [accountValues, setAccountValues] = useState<Record<string, string>>({});
  const [paymentId, setPaymentId] = useState<string>(paymentMethods[0]?.id ?? '');
  const [proofFileName, setProofFileName] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [qrPayment, setQrPayment] = useState<PaymentMethod | null>(null);
  const [facebookName, setFacebookName] = useState('');
  const [email, setEmail] = useState('');
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
  const stepOrder = showCategoryStep ? 3 : 2;
  const stepPayment = showCategoryStep ? 4 : 3;
  const stepQuantity = showCategoryStep ? 5 : 4;
  const stepProof = showCategoryStep ? 6 : 5;
  const stepConfirmation = showCategoryStep ? 7 : 6;

  function selectCategory(id: string) {
    setCategoryId(id);
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

  async function submitOrder() {
    if (!category) return;
    for (const f of category.fields) {
      if (!accountValues[f.id]?.trim()) {
        setResult({ ok: false, msg: `Please fill in "${f.label}".` });
        return goTo(accountFieldRefs.current[f.id]);
      }
    }
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
    if (category.events.length > 0 && selectedEvent && selectedHero && selectedEvent.schedule.length > 0 && !selectedPhase) {
      setResult({ ok: false, msg: 'Please select a delivery schedule first.' });
      return goTo(orderPanelRef.current);
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
        const ext = proofFile.name.split('.').pop();
        const path = `${game.slug}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('proof-of-payments')
          .upload(path, proofFile);
        if (uploadError) {
          setResult({ ok: false, msg: 'Failed to upload proof of payment. Please try again.' });
          setSubmitting(false);
          return;
        }
        proofPath = path;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          categoryId: category.id,
          itemId: item?.id ?? null,
          eventId: selectedEvent?.id ?? null,
          accountFields: accountValues,
          quantity,
          unitPrice,
          paymentMethodId: paymentId,
          proofOfPaymentUrl: proofPath,
          facebookName,
          email,
        }),
      });
      if (!res.ok) throw new Error('Server rejected the order.');
      const data = await res.json();
      setResult({ ok: true, msg: `Order submitted! Your order ID is ${data.id}. We'll process it shortly.` });
    } catch (e) {
      setResult({ ok: false, msg: 'Something went wrong submitting your order. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="order-wrap">
      {/* LEFT COLUMN */}
      <div>
        <div className="panel game-banner">
          <img src={`/games/${game.slug}.png`} alt={game.name} />
          <div>
            <h1>{game.name}</h1>
            {game.description && <p>{game.description}</p>}
          </div>
        </div>

        {showCategoryStep && (
          <div className="panel">
            <div className="panel-head"><span className="step-num">2</span><h2>Select Category</h2></div>
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

        <div className="panel" ref={orderPanelRef}>
          <div className="panel-head"><span className="step-num">{stepOrder}</span><h2>Select Order ({category?.name})</h2></div>
          {category && category.items.length > 0 && (
            <div className="item-grid">
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
                  {selectedEvent.heroes.map((h) => (
                    <button key={h.id} className={`hero-card ${heroId === h.id ? 'active' : ''}`} onClick={() => { setHeroId(h.id); setPhaseId(''); }}>
                      <div className="name">{h.heroName}</div>
                      <div className="price">From ₱{h.price}</div>
                    </button>
                  ))}
                </div>
              )}

              {selectedEvent && selectedHero && selectedEvent.schedule.length > 0 && (
                <>
                  <p className="field-hint" style={{ marginTop: 4 }}>Delivery Schedule — {selectedHero.heroName} (price depends on when you order)</p>
                  <div className="schedule-grid">
                    {selectedEvent.schedule.map((s) => (
                      <button key={s.id} className={`phase-btn ${phaseId === s.id ? 'active' : ''}`} onClick={() => setPhaseId(s.id)}>
                        <span>
                          {s.phaseName}
                          <span className="range">{new Date(s.startDate).toLocaleDateString()} – {new Date(s.endDate).toLocaleDateString()}</span>
                        </span>
                        <span>₱{s.price}</span>
                      </button>
                    ))}
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

        <div className="panel" ref={paymentPanelRef}>
          <div className="panel-head"><span className="step-num">{stepPayment}</span><h2>Choose Payment Method</h2></div>
          {paymentMethods.map((p) => {
            const slug = p.name.toLowerCase().replace(/\s+/g, '-');
            return (
              <div key={p.id} className={`pay-row-v2 ${paymentId === p.id ? 'active' : ''}`} onClick={() => setPaymentId(p.id)}>
                <img className="pay-logo" src={`/payments/logos/${slug}.png`} alt={p.name} />
                <span className="pay-name">{p.name}</span>
                <span className="pay-account-name">{p.accountName}</span>
                <span className="pay-account-number">{p.accountNumber}</span>
                <button
                  type="button"
                  className="view-qr-btn"
                  onClick={(e) => { e.stopPropagation(); setQrPayment(p); }}
                >
                  ⊞ View QR
                </button>
              </div>
            );
          })}
        </div>

        {qrPayment && (
          <div className="qr-modal-overlay" onClick={() => setQrPayment(null)}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <button className="qr-modal-close" onClick={() => setQrPayment(null)}>✕</button>
              <h3>{qrPayment.name}</h3>
              <img src={`/payments/qr/${qrPayment.name.toLowerCase().replace(/\s+/g, '-')}.png`} alt={`${qrPayment.name} QR code`} />
              <p className="field-hint">{qrPayment.accountName} · {qrPayment.accountNumber}</p>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN */}
      <div>
        <div className="panel">
          <div className="panel-head"><span className="step-num">1</span><h2>Account Details</h2></div>
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
        </div>

        <div className="panel">
          <div className="panel-head"><span className="step-num">{stepQuantity}</span><h2>Order Quantity</h2></div>
          <div className="qty-row">
            <button className="qty-btn" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
            <div className="qty-val">{quantity}</div>
            <button className="qty-btn" onClick={() => setQuantity((q) => q + 1)}>+</button>
          </div>
          <div className="price-row"><span>Price</span><span>₱{total}</span></div>
        </div>

        <div className="panel" ref={proofPanelRef}>
          <div className="panel-head"><span className="step-num">{stepProof}</span><h2>Proof of Payment</h2></div>
          <label className="upload-box">
            {proofFileName || 'Click to attach your receipt or screenshot of payment'}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setProofFile(f);
                setProofFileName(f?.name ?? '');
              }}
            />
          </label>
          <p className="field-hint" style={{ color: '#e0c26a', marginTop: 8 }}>NO RECEIPT = NO PROCESS</p>
        </div>

        <div className="panel">
          <div className="panel-head"><span className="step-num">{stepConfirmation}</span><h2>Order Confirmation</h2></div>
          <input ref={facebookRef} className="field-input" placeholder="Enter Facebook Account / Name *" value={facebookName} onChange={(e) => setFacebookName(e.target.value)} required />
          <p className="field-hint">So the seller can reach you if there's an issue with your order</p>
          <input ref={emailRef} className="field-input" type="email" placeholder="Enter Email *" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <p className="field-hint">We'll send your transaction receipt to this address</p>

          {result && <div className={result.ok ? 'success-msg' : 'error-msg'}>{result.msg}</div>}

          <button className="submit-btn" disabled={submitting} onClick={submitOrder}>
            {submitting ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
