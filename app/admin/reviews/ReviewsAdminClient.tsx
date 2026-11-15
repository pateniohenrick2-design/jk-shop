'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ReviewSummary } from '@/lib/reviews';
import { Stars } from '@/components/ReviewModal';

type AdminReview = {
  id: string; displayName: string; rating: number; comment: string | null; images: string[]; itemName: string;
  gameName: string; orderCode: string; email: string; hidden: boolean; adminReply: string | null; createdAt: string;
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'low', label: '1–2 stars' },
  { key: 'photos', label: 'With photos' },
  { key: 'hidden', label: 'Hidden' },
];
const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function ReviewsAdminClient({
  reviews: initial, filter, page, pages, total, summary, hiddenCount,
}: {
  reviews: AdminReview[]; filter: string; page: number; pages: number; total: number; summary: ReviewSummary; hiddenCount: number;
}) {
  const [reviews, setReviews] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, data: { hidden?: boolean; adminReply?: string | null }) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const body = await res.json();
      if (!res.ok) throw new Error();
      setReviews((list) => list.map((r) => (r.id === id ? { ...r, hidden: body.hidden, adminReply: body.adminReply } : r)));
      setReplyOpen(null);
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const link = (f: string, p = 1) => `/admin/reviews?${new URLSearchParams({ ...(f !== 'all' ? { filter: f } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString()}`;

  return (
    <div>
      <h1 className="admin-page-title">Reviews</h1>
      <p className="field-hint">Reviews go live as soon as customers post them. Hide anything inappropriate, or reply publicly.</p>

      <div className="dash-kpis" style={{ marginTop: 14 }}>
        <div className="dash-kpi"><span className="dash-tile-label">Average rating</span><span className="dash-kpi-value">★ {summary.average.toFixed(1)}</span></div>
        <div className="dash-kpi"><span className="dash-tile-label">Visible reviews</span><span className="dash-kpi-value">{summary.count}</span></div>
        <div className="dash-kpi"><span className="dash-tile-label">5-star share</span><span className="dash-kpi-value">{summary.count ? Math.round((summary.counts[5] / summary.count) * 100) : 0}%</span></div>
        <div className="dash-kpi"><span className="dash-tile-label">Hidden</span><span className="dash-kpi-value">{hiddenCount}</span></div>
      </div>

      <nav className="dash-range" aria-label="Filter reviews">
        {FILTERS.map((f) => (
          <Link key={f.key} href={link(f.key)} className={`dash-range-btn${filter === f.key ? ' active' : ''}`}>{f.label}</Link>
        ))}
        <span className="muted dash-range-note">{total} review{total === 1 ? '' : 's'}</span>
      </nav>

      {error && <p className="error-msg">{error}</p>}

      <div className="panel">
        {reviews.length === 0 && <p className="field-hint">No reviews here yet.</p>}
        <ul className="arv-list">
          {reviews.map((r) => (
            <li key={r.id} className={`arv-item${r.hidden ? ' is-hidden' : ''}`}>
              <div className="arv-top">
                <div>
                  <strong>{r.displayName}</strong> <Stars value={r.rating} size={14} />
                  <div className="arv-meta">{r.gameName} · {r.itemName} · {r.orderCode} · {when(r.createdAt)}</div>
                  {r.email && <div className="arv-meta">{r.email}</div>}
                </div>
                <span className={`badge ${r.hidden ? 'badge-failed' : 'badge-successful'}`}>{r.hidden ? 'Hidden' : 'Live'}</span>
              </div>
              {r.comment && <p className="arv-text">{r.comment}</p>}
              {r.images.length > 0 && (
                <div className="rv-imgs">
                  {r.images.map((src) => (
                    <button key={src} type="button" className="rv-img" onClick={() => setPhoto(src)} aria-label="View photo"><img src={src} alt="" /></button>
                  ))}
                </div>
              )}
              {r.adminReply && replyOpen !== r.id && <div className="rv-reply"><strong>Your reply:</strong> {r.adminReply}</div>}

              {replyOpen === r.id && (
                <div className="arv-reply-box">
                  <textarea
                    className="field-input"
                    rows={2}
                    maxLength={500}
                    placeholder="Thanks for ordering! 💚"
                    value={replyDraft[r.id] ?? r.adminReply ?? ''}
                    onChange={(e) => setReplyDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                  />
                  <div className="arv-actions">
                    <button type="button" className="pl-btn" onClick={() => setReplyOpen(null)} disabled={busy === r.id}>Cancel</button>
                    {r.adminReply && <button type="button" className="pl-btn" onClick={() => patch(r.id, { adminReply: null })} disabled={busy === r.id}>Remove reply</button>}
                    <button type="button" className="pl-btn pl-btn-primary" onClick={() => patch(r.id, { adminReply: replyDraft[r.id] ?? r.adminReply ?? '' })} disabled={busy === r.id}>
                      {busy === r.id ? 'Saving…' : 'Post reply'}
                    </button>
                  </div>
                </div>
              )}

              {replyOpen !== r.id && (
                <div className="arv-actions">
                  <button type="button" className="pl-btn" onClick={() => setReplyOpen(r.id)}>{r.adminReply ? 'Edit reply' : 'Reply'}</button>
                  <button type="button" className={`pl-btn${r.hidden ? ' pl-btn-primary' : ''}`} disabled={busy === r.id} onClick={() => patch(r.id, { hidden: !r.hidden })}>
                    {r.hidden ? 'Show again' : 'Hide'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {pages > 1 && (
          <nav className="orders-pager" aria-label="Review pages">
            <span className="orders-pager-info">Page {page} of {pages}</span>
            <div className="orders-pager-btns">
              {page > 1 ? <Link className="orders-page-btn" href={link(filter, page - 1)}>‹ Previous</Link> : <span className="orders-page-btn" aria-disabled style={{ opacity: .4 }}>‹ Previous</span>}
              {page < pages ? <Link className="orders-page-btn" href={link(filter, page + 1)}>Next ›</Link> : <span className="orders-page-btn" aria-disabled style={{ opacity: .4 }}>Next ›</span>}
            </div>
          </nav>
        )}
      </div>

      {photo && (
        <div className="qr-modal-overlay" onClick={() => setPhoto(null)}>
          <div className="rv-viewer" onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={() => setPhoto(null)} aria-label="Close">✕</button>
            <img src={photo} alt="Review photo" />
          </div>
        </div>
      )}
    </div>
  );
}
