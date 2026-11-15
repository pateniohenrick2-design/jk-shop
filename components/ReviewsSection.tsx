'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublicReview, ReviewSummary } from '@/lib/reviews';
import { Stars } from '@/components/ReviewModal';
import ThemedSelect from '@/components/ThemedSelect';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

// Public reviews: summary (average + star bars), "All / With photos" filter, list, "Load more".
// gameSlug = one game's reviews (game page); games = show a game picker (the /reviews page).
export default function ReviewsSection({
  gameSlug,
  games,
  title = 'Customer reviews',
}: {
  gameSlug?: string;
  games?: { slug: string; name: string }[];
  title?: string;
}) {
  const [game, setGame] = useState(gameSlug ?? '');
  const [photos, setPhotos] = useState(false);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<{ list: string[]; i: number } | null>(null);

  const load = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p) });
      if (game) qs.set('game', game);
      if (photos) qs.set('photos', '1');
      const res = await fetch(`/api/reviews?${qs.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error();
      setReviews((prev) => (append ? [...prev, ...body.reviews] : body.reviews));
      setSummary(body.summary);
      setPage(body.page);
      setPages(body.pages);
      setTotal(body.total);
    } catch {
      if (!append) setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [game, photos]);

  useEffect(() => { load(1, false); }, [load]);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(null);
      if (e.key === 'ArrowRight') setViewer((v) => v && { ...v, i: (v.i + 1) % v.list.length });
      if (e.key === 'ArrowLeft') setViewer((v) => v && { ...v, i: (v.i - 1 + v.list.length) % v.list.length });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewer]);

  // A single game with no reviews yet: say so briefly instead of a big empty block
  const empty = !loading && summary && summary.count === 0;

  return (
    <section className="rv" aria-labelledby="rv-title">
      <div className="rv-head">
        <h2 id="rv-title">{title}</h2>
        {games && (
          <ThemedSelect
            className="rv-game-sel"
            ariaLabel="Filter reviews by game"
            value={game}
            onChange={setGame}
            options={[{ value: '', label: 'All games' }, ...games.map((g) => ({ value: g.slug, label: g.name }))]}
          />
        )}
      </div>

      {empty && !photos ? (
        <p className="rv-empty">No reviews yet. After your order is completed, you can leave one from <Link href="/my-orders">My Orders</Link>.</p>
      ) : (
        <>
          {summary && summary.count > 0 && (
            <div className="rv-summary">
              <div className="rv-avg">
                <strong>{summary.average.toFixed(1)}</strong>
                <Stars value={summary.average} size={18} />
                <span>{summary.count.toLocaleString('en-PH')} review{summary.count === 1 ? '' : 's'}</span>
              </div>
              <ul className="rv-bars" aria-label="Rating breakdown">
                {([5, 4, 3, 2, 1] as const).map((n) => (
                  <li key={n}>
                    <span>{n}★</span>
                    <span className="rv-bar"><span style={{ width: `${summary.count ? (summary.counts[n] / summary.count) * 100 : 0}%` }} /></span>
                    <span className="rv-bar-n">{summary.counts[n]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rv-filters" role="tablist" aria-label="Filter">
            <button type="button" role="tab" aria-selected={!photos} className={!photos ? 'active' : ''} onClick={() => setPhotos(false)}>All</button>
            <button type="button" role="tab" aria-selected={photos} className={photos ? 'active' : ''} onClick={() => setPhotos(true)}>With photos</button>
          </div>

          {!loading && reviews.length === 0 && <p className="rv-empty">No reviews with photos yet.</p>}

          <ul className={`rv-list${loading && reviews.length ? ' rv-loading' : ''}`}>
            {reviews.map((r) => (
              <li key={r.id} className="rv-item">
                <div className="rv-item-top">
                  <span className="rv-avatar" aria-hidden>{r.displayName[0]?.toUpperCase()}</span>
                  <div className="rv-who">
                    <strong>{r.displayName}</strong>
                    <span className="rv-verified">✓ Verified order · {r.itemName}{!gameSlug ? ` · ${r.gameName}` : ''}</span>
                  </div>
                  <span className="rv-date">{when(r.createdAt)}</span>
                </div>
                <Stars value={r.rating} />
                {r.comment && <p className="rv-text">{r.comment}</p>}
                {r.images.length > 0 && (
                  <div className="rv-imgs">
                    {r.images.map((src, i) => (
                      <button key={src} type="button" className="rv-img" aria-label={`View photo ${i + 1}`} onClick={() => setViewer({ list: r.images, i })}>
                        <img src={src} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
                {r.adminReply && (
                  <div className="rv-reply"><strong>JK Shop replied:</strong> {r.adminReply}</div>
                )}
              </li>
            ))}
          </ul>

          {page < pages && (
            <button type="button" className="rv-more" disabled={loading} onClick={() => load(page + 1, true)}>
              {loading ? 'Loading…' : `Show more reviews (${total - reviews.length} more)`}
            </button>
          )}
        </>
      )}

      {viewer && (
        <div className="qr-modal-overlay" onClick={() => setViewer(null)}>
          <div className="rv-viewer" role="dialog" aria-modal="true" aria-label="Review photo" onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={() => setViewer(null)} aria-label="Close">✕</button>
            <img src={viewer.list[viewer.i]} alt="Review photo" />
            {viewer.list.length > 1 && (
              <>
                <button type="button" className="proof-nav prev" aria-label="Previous photo" onClick={() => setViewer({ ...viewer, i: (viewer.i - 1 + viewer.list.length) % viewer.list.length })}>‹</button>
                <button type="button" className="proof-nav next" aria-label="Next photo" onClick={() => setViewer({ ...viewer, i: (viewer.i + 1) % viewer.list.length })}>›</button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
