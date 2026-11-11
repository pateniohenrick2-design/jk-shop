'use client';

import { useEffect, useState } from 'react';
import { manilaStartOfDay, isSoldOut, toManilaDateString } from '@/lib/manilaDate';

// soldOutOn: "YYYY-MM-DD" (Philippine day the phase becomes sold out) or "" for never
type SchedulePhase = { phaseName: string; startDate: string; endDate: string; price: number; soldOutOn: string };
type Hero = { heroName: string; price: number; imageUrl: string | null; schedule: SchedulePhase[] };
type EventRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  heroes: Hero[];
};

type HeroDraft = {
  heroName: string;
  imageFile: File | null;
  imagePreview: string | null;
  existingImageUrl: string | null;
};

// One phase row = shared label/dates; price is entered per hero (index-aligned with heroDrafts)
type PhaseDraft = {
  phaseName: string;
  startDate: string;
  endDate: string;
  soldOutOn: string; // "" = stays available until the event ends
  pricesByHero: string[];
};

function eventStatus(startDate: string, endDate: string): 'scheduled' | 'active' | 'expired' {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return 'scheduled';
  if (today > endDate) return 'expired';
  return 'active';
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  active: 'Active',
  expired: 'Expired',
};

// Delivery schedule phase names the admin can pick from
const PHASE_LABELS = ['First Week', 'Phase 1', 'Phase 2', 'Last Day'];

function emptyHeroDraft(): HeroDraft {
  return { heroName: '', imageFile: null, imagePreview: null, existingImageUrl: null };
}

function emptyPhaseDraft(heroCount: number): PhaseDraft {
  return { phaseName: '', startDate: '', endDate: '', soldOutOn: '', pricesByHero: Array(heroCount).fill('') };
}

// Rebuild each event's unique phase list (name+dates) from the per-hero schedule arrays,
// since phases are stored per-hero in the DB but shown/edited as one shared row in the UI.
type PhaseInfo = { phaseName: string; startDate: string; endDate: string; soldOutOn: string };
function derivePhasesFromHeroes(heroes: Hero[]): PhaseInfo[] {
  const seen = new Map<string, PhaseInfo>();
  for (const h of heroes) {
    for (const s of h.schedule) {
      const key = `${s.phaseName}|${s.startDate}|${s.endDate}`;
      if (!seen.has(key)) seen.set(key, { phaseName: s.phaseName, startDate: s.startDate, endDate: s.endDate, soldOutOn: s.soldOutOn });
    }
  }
  return Array.from(seen.values());
}

export default function EventsClient({
  initialEvents,
  categoryId,
}: {
  initialEvents: EventRow[];
  categoryId: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [heroDrafts, setHeroDrafts] = useState<HeroDraft[]>([emptyHeroDraft()]);
  const [phaseDrafts, setPhaseDrafts] = useState<PhaseDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // Esc closes the add/edit modal (unless a save is in progress)
  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) resetForm(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, submitting]);

  function openAdd() {
    resetForm();
    setFormOpen(true);
  }
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Cheapest delivery-schedule price entered for hero i (null if none) — this is the hero's price
  function lowestPrice(i: number, phases: PhaseDraft[] = phaseDrafts): number | null {
    const prices = phases
      .map((p) => parseFloat(p.pricesByHero[i] ?? ''))
      .filter((n) => !isNaN(n) && n > 0);
    return prices.length ? Math.min(...prices) : null;
  }

  function updateHero(i: number, field: 'heroName', value: string) {
    setHeroDrafts((prev) => prev.map((h, idx) => (idx === i ? { ...h, [field]: value } : h)));
  }

  function handleHeroImageChange(i: number, file: File | null) {
    setHeroDrafts((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, imageFile: file, imagePreview: file ? URL.createObjectURL(file) : null } : h))
    );
  }

  function addHeroRow() {
    setHeroDrafts((prev) => [...prev, emptyHeroDraft()]);
    setPhaseDrafts((prev) => prev.map((p) => ({ ...p, pricesByHero: [...p.pricesByHero, ''] })));
  }

  function removeHeroRow(i: number) {
    if (heroDrafts.length === 1) return;
    setHeroDrafts((prev) => prev.filter((_, idx) => idx !== i));
    setPhaseDrafts((prev) => prev.map((p) => ({ ...p, pricesByHero: p.pricesByHero.filter((_, idx) => idx !== i) })));
  }

  function updatePhaseField(i: number, field: 'phaseName' | 'startDate' | 'endDate' | 'soldOutOn', value: string) {
    setPhaseDrafts((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  function updatePhasePrice(phaseIdx: number, heroIdx: number, value: string) {
    setPhaseDrafts((prev) =>
      prev.map((p, idx) =>
        idx === phaseIdx
          ? { ...p, pricesByHero: p.pricesByHero.map((v, hIdx) => (hIdx === heroIdx ? value : v)) }
          : p
      )
    );
  }

  function addPhaseRow() {
    setPhaseDrafts((prev) => [...prev, emptyPhaseDraft(heroDrafts.length)]);
  }

  function removePhaseRow(i: number) {
    setPhaseDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  function resetForm() {
    setFormOpen(false);
    setEditingId(null);
    setName(''); setStartDate(''); setEndDate('');
    setHeroDrafts([emptyHeroDraft()]);
    setPhaseDrafts([]);
    setError(null);
  }

  function startEdit(e: EventRow) {
    setEditingId(e.id);
    setName(e.name);
    setStartDate(e.startDate);
    setEndDate(e.endDate);

    const heroes = e.heroes.length
      ? e.heroes.map((h) => ({
          heroName: h.heroName,
          imageFile: null,
          imagePreview: null,
          existingImageUrl: h.imageUrl,
        }))
      : [emptyHeroDraft()];
    setHeroDrafts(heroes);

    const uniquePhases = derivePhasesFromHeroes(e.heroes);
    setPhaseDrafts(
      uniquePhases.map((phase) => ({
        phaseName: phase.phaseName,
        startDate: phase.startDate,
        endDate: phase.endDate,
        soldOutOn: phase.soldOutOn,
        pricesByHero: e.heroes.map((h) => {
          const match = h.schedule.find(
            (s) => s.phaseName === phase.phaseName && s.startDate === phase.startDate && s.endDate === phase.endDate
          );
          return match ? String(match.price) : '';
        }),
      }))
    );

    setError(null);
    setFormOpen(true);
  }

  async function submitEvent() {
    setError(null);
    if (!name.trim()) { setError('Event name is required.'); return; }
    if (!startDate || !endDate) { setError('Start and end date are required.'); return; }
    if (endDate < startDate) { setError('End date must be after start date.'); return; }
    // Original positions of the named heroes (phase prices are stored by these positions)
    const heroIdx = heroDrafts.map((h, i) => (h.heroName.trim() ? i : -1)).filter((i) => i >= 0);
    const validHeroes = heroIdx.map((i) => heroDrafts[i]);
    if (validHeroes.length === 0) { setError('Add at least one hero skin.'); return; }
    if (phaseDrafts.some((p) => !p.phaseName.trim() && (p.startDate || p.endDate || p.pricesByHero.some(Boolean)))) {
      setError('Choose a phase label for every delivery schedule phase (or remove the empty one).');
      return;
    }
    const validPhases = phaseDrafts.filter((p) => p.phaseName.trim());
    if (validPhases.some((p) => !p.startDate || !p.endDate)) {
      setError('Every delivery schedule phase needs a start and end date.');
      return;
    }
    // Each hero's price now comes from the delivery schedule, so it needs at least one phase price
    const unpriced = heroIdx.filter((i) => lowestPrice(i, validPhases) == null).map((i) => heroDrafts[i].heroName.trim());
    if (validPhases.length === 0) { setError('Add at least one delivery schedule phase with prices.'); return; }
    if (unpriced.length) {
      setError(`Add a delivery schedule price for: ${unpriced.join(', ')}.`);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      if (!editingId) formData.append('categoryId', categoryId);
      formData.append('name', name.trim());
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      formData.append('heroCount', String(validHeroes.length));
      validHeroes.forEach((h, i) => {
        formData.append(`heroName_${i}`, h.heroName.trim());
        if (h.imageFile) formData.append(`heroImage_${i}`, h.imageFile);
        if (h.existingImageUrl) formData.append(`heroExistingImage_${i}`, h.existingImageUrl);
      });
      formData.append('scheduleCount', String(validPhases.length));
      validPhases.forEach((p, pIdx) => {
        formData.append(`phaseName_${pIdx}`, p.phaseName.trim());
        formData.append(`phaseStart_${pIdx}`, p.startDate);
        formData.append(`phaseEnd_${pIdx}`, p.endDate);
        if (p.soldOutOn) formData.append(`phaseSoldOut_${pIdx}`, p.soldOutOn);
        heroIdx.forEach((orig, hIdx) => {
          const price = p.pricesByHero[orig] ?? '';
          if (price) formData.append(`schedulePrice_${pIdx}_${hIdx}`, price);
        });
      });

      const url = editingId ? `/api/events/${editingId}` : '/api/events';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save event.');
      }
      const saved = await res.json();
      const savedRow: EventRow = {
        id: saved.id,
        name: saved.name,
        startDate: saved.startDate.slice(0, 10),
        endDate: saved.endDate.slice(0, 10),
        heroes: saved.heroes.map((h: any) => ({
          heroName: h.heroName,
          price: Number(h.price),
          imageUrl: h.imageUrl,
          schedule: (h.schedule ?? []).map((s: any) => ({
            phaseName: s.phaseName,
            startDate: s.startDate.slice(0, 10),
            endDate: s.endDate.slice(0, 10),
            price: Number(s.price),
            soldOutOn: s.soldOutAt ? toManilaDateString(s.soldOutAt) : '',
          })),
        })),
      };

      setEvents((prev) =>
        editingId ? prev.map((e) => (e.id === editingId ? savedRow : e)) : [savedRow, ...prev]
      );
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save event.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete event.');
      }
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) resetForm();
    } catch (err: any) {
      alert(err.message || 'Failed to delete event.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="events-page-head">
        <div>
          <h1 className="admin-page-title">Pre-Order Event &amp; Event Skin Gifting</h1>
          <p className="field-hint" style={{ margin: 0 }}>Schedule events; they auto-hide from customers once the end date passes.</p>
        </div>
        <button className="pl-btn pl-btn-primary" onClick={openAdd}>+ Add Event</button>
      </div>

      <div className="panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Event / Hero Skins</th>
              <th>Price</th>
              <th>Schedule</th>
              <th>Delivery Schedule (per hero)</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr><td colSpan={7} className="pl-empty-row">No events yet. Click <strong>+ Add Event</strong> to schedule one.</td></tr>
            )}
            {events.map((e) => {
              const status = eventStatus(e.startDate, e.endDate);
              const firstImage = e.heroes.find((h) => h.imageUrl)?.imageUrl ?? null;
              const prices = e.heroes.map((h) => h.price).filter((p) => !isNaN(p));
              const priceLabel = prices.length
                ? (Math.min(...prices) === Math.max(...prices)
                    ? `₱${Math.min(...prices)}`
                    : `₱${Math.min(...prices)} – ₱${Math.max(...prices)}`)
                : '—';
              const uniquePhases = derivePhasesFromHeroes(e.heroes);
              return (
                <tr key={e.id}>
                  <td>
                    {firstImage
                      ? <img src={`/api/image-proxy?key=${encodeURIComponent(firstImage)}`} alt={e.name} className="event-thumb" />
                      : <div className="event-thumb" />}
                  </td>
                  <td>
                    {e.name}
                    <br />
                    <span className="field-hint">
                      {e.heroes.length ? e.heroes.map((h) => `${h.heroName} (₱${h.price})`).join(', ') : 'TBD'}
                    </span>
                  </td>
                  <td>{priceLabel}</td>
                  <td>{e.startDate} → {e.endDate}</td>
                  <td>
                    {uniquePhases.length === 0 && <span className="field-hint">—</span>}
                    {uniquePhases.map((phase, i) => (
                      <div key={i} className="field-hint" style={{ marginBottom: 4 }}>
                        <strong>{phase.phaseName}</strong> ({phase.startDate} → {phase.endDate})
                        {phase.soldOutOn && (
                          isSoldOut(manilaStartOfDay(phase.soldOutOn))
                            ? <span className="badge badge-expired phase-soldout-badge">Sold out</span>
                            : <span className="phase-soldout-note">· sold out on {phase.soldOutOn}</span>
                        )}
                        :{' '}
                        {e.heroes
                          .map((h) => {
                            const match = h.schedule.find(
                              (s) => s.phaseName === phase.phaseName && s.startDate === phase.startDate && s.endDate === phase.endDate
                            );
                            return match ? `${h.heroName} ₱${match.price}` : null;
                          })
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    ))}
                  </td>
                  <td><span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="qty-btn"
                      style={{ width: 'auto', padding: '6px 12px', fontSize: 12, marginRight: 6 }}
                      onClick={() => startEdit(e)}
                    >
                      Edit
                    </button>
                    <button
                      className="qty-btn"
                      style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      disabled={deletingId === e.id}
                      onClick={() => deleteEvent(e.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {formOpen && (
      <div className="qr-modal-overlay event-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) resetForm(); }}>
      <div className="event-modal event-form" role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
        <div className="event-modal-head">
          <h3 id="event-modal-title">{editingId ? 'Edit Event' : 'Add New Event'}</h3>
          <button className="qr-modal-close" style={{ position: 'static' }} aria-label="Close" disabled={submitting} onClick={resetForm}>✕</button>
        </div>
        <div className="event-modal-body">
        {error && <p className="error-msg">{error}</p>}

        {/* 1. Event details */}
        <section className="event-section">
          <div className="event-section-title">
            <span className="event-step">1</span>
            <div>
              <h4>Event Details</h4>
              <p>The event is hidden from customers automatically after the end date.</p>
            </div>
          </div>
          <div className="event-details-grid">
            <div>
              <label className="field-label" htmlFor="ev-name">Event Name</label>
              <input id="ev-name" className="field-input" placeholder="e.g. Jujutsu Kaisen" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="ev-start">Start Date</label>
              <input id="ev-start" className="field-input" type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="ev-end">End Date</label>
              <input id="ev-end" className="field-input" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </section>

        {/* 2. Hero skins */}
        <section className="event-section">
          <div className="event-section-title">
            <span className="event-step">2</span>
            <div>
              <h4>Hero Skins</h4>
              <p>Add every skin available in this event, with its image. Prices are set per phase in the Delivery Schedule — each skin starts at its cheapest phase.</p>
            </div>
          </div>

          <div className="event-hero-list">
            {heroDrafts.map((h, i) => {
              const preview = h.imagePreview ?? (h.existingImageUrl ? `/api/image-proxy?key=${encodeURIComponent(h.existingImageUrl)}` : null);
              return (
                <div key={i} className="event-hero-card">
                  <label className="event-image-picker" title={preview ? 'Click to replace image' : 'Click to upload image'}>
                    {preview ? <img src={preview} alt="" /> : <span>+ Image</span>}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => handleHeroImageChange(i, e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <div className="event-hero-fields">
                    <div>
                      <label className="field-label" htmlFor={`hero-name-${i}`}>Hero Name</label>
                      <input
                        id={`hero-name-${i}`}
                        className="field-input"
                        placeholder="e.g. Kagura"
                        value={h.heroName}
                        onChange={(e) => updateHero(i, 'heroName', e.target.value)}
                      />
                    </div>
                    <div>
                      <span className="field-label">Starting Price</span>
                      {(() => {
                        const low = lowestPrice(i);
                        return (
                          <div className={`hero-auto-price ${low == null ? 'empty' : ''}`}>
                            {low == null ? 'Set in Delivery Schedule ↓' : <><strong>₱{low}</strong> <span>cheapest phase</span></>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  {heroDrafts.length > 1 && (
                    <button
                      type="button"
                      className="event-remove-btn"
                      aria-label={`Remove ${h.heroName || `hero ${i + 1}`}`}
                      title="Remove"
                      onClick={() => removeHeroRow(i)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" className="event-add-btn" onClick={addHeroRow}>+ Add another hero skin</button>
        </section>

        {/* 3. Delivery schedule */}
        <section className="event-section">
          <div className="event-section-title">
            <span className="event-step">3</span>
            <div>
              <h4>Delivery Schedule</h4>
              <p>Each phase applies to all heroes above. Prices can differ per hero; leave one blank to skip that hero for the phase.
                Set <strong>Sold Out On</strong> to stop customers picking a phase from 12:00 AM (PH time) that day — pick today to sell it out right away.</p>
            </div>
          </div>

          {phaseDrafts.map((p, phaseIdx) => (
            <div key={phaseIdx} className="event-phase-block">
              <div className="event-phase-row">
                <div>
                  <label className="field-label">Phase Label</label>
                  <select
                    className="field-input"
                    value={p.phaseName}
                    onChange={(e) => updatePhaseField(phaseIdx, 'phaseName', e.target.value)}
                  >
                    <option value="" disabled>Select phase…</option>
                    {PHASE_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    {/* Older events may use a label that isn't in the list — keep it selectable */}
                    {p.phaseName && !PHASE_LABELS.includes(p.phaseName) && (
                      <option value={p.phaseName}>{p.phaseName}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="field-label">Start Date</label>
                  <input
                    className="field-input"
                    type="date"
                    value={p.startDate}
                    max={p.endDate || undefined}
                    onChange={(e) => updatePhaseField(phaseIdx, 'startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">End Date</label>
                  <input
                    className="field-input"
                    type="date"
                    value={p.endDate}
                    min={p.startDate || undefined}
                    onChange={(e) => updatePhaseField(phaseIdx, 'endDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">
                    Sold Out On <span className="event-optional">Optional</span>
                  </label>
                  <div className="phase-soldout-input">
                    <input
                      className="field-input"
                      type="date"
                      value={p.soldOutOn}
                      onChange={(e) => updatePhaseField(phaseIdx, 'soldOutOn', e.target.value)}
                    />
                    {p.soldOutOn && (
                      <button
                        type="button"
                        className="phase-soldout-clear"
                        aria-label="Clear sold-out date"
                        title="Clear (keep available)"
                        onClick={() => updatePhaseField(phaseIdx, 'soldOutOn', '')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="event-remove-btn"
                  aria-label="Remove phase"
                  title="Remove phase"
                  onClick={() => removePhaseRow(phaseIdx)}
                >
                  ×
                </button>
              </div>

              <div className="event-phase-hero-prices">
                {heroDrafts.map((h, heroIdx) => (
                  <div key={heroIdx}>
                    <label className="field-label">{h.heroName.trim() || `Hero ${heroIdx + 1}`}</label>
                    <div className="input-prefix">
                      <span>₱</span>
                      <input
                        className="field-input"
                        type="number"
                        min="0"
                        placeholder="Skip"
                        value={p.pricesByHero[heroIdx] ?? ''}
                        onChange={(e) => updatePhasePrice(phaseIdx, heroIdx, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className="event-add-btn" onClick={addPhaseRow}>+ Add delivery phase</button>
        </section>

        </div>
        <div className="event-form-actions event-modal-foot">
          <button className="event-secondary-btn" disabled={submitting} onClick={resetForm}>
            Cancel
          </button>
          <button className="submit-btn" style={{ width: 'auto', padding: '12px 28px' }} disabled={submitting} onClick={submitEvent}>
            {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
