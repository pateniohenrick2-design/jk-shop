'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/compressImage';
import { MAX_REVIEW_COMMENT, MAX_REVIEW_IMAGES } from '@/lib/reviews';

// Read-only stars, e.g. ★★★★☆
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? 'on' : ''} aria-hidden>★</span>
      ))}
    </span>
  );
}

type Existing = { rating: number; comment: string | null; imageUrls: string[]; images: string[] } | null;
type Img = { url: string; preview: string; uploading?: boolean };

const LABELS = ['', 'Bad', 'Not good', 'Okay', 'Good', 'Excellent'];

// Write / edit the review of one completed order (stars + message + up to 3 photos)
export default function ReviewModal({
  orderCode, itemName, existing, onClose, onSaved,
}: { orderCode: string; itemName: string; existing: Existing; onClose: () => void; onSaved: () => void }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [imgs, setImgs] = useState<Img[]>(
    (existing?.imageUrls ?? []).map((url, i) => ({ url, preview: existing?.images[i] ?? url })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [busy, onClose]);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? '';
  }

  async function addImages(files: FileList | null) {
    if (!files) return;
    const room = MAX_REVIEW_IMAGES - imgs.length;
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      const preview = URL.createObjectURL(file);
      setImgs((list) => [...list, { url: '', preview, uploading: true }]);
      try {
        const form = new FormData();
        form.append('file', await compressImage(file));
        form.append('folder', 'reviews');
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.url) throw new Error(body.error || 'Upload failed');
        setImgs((list) => list.map((im) => (im.preview === preview ? { ...im, url: body.url, uploading: false } : im)));
      } catch (e) {
        setImgs((list) => list.filter((im) => im.preview !== preview));
        setError(e instanceof Error ? e.message : 'Photo upload failed. Please try again.');
      }
    }
    if (files.length > room) setError(`You can add up to ${MAX_REVIEW_IMAGES} photos.`);
  }

  async function save() {
    if (!rating) return setError('Please tap the stars to rate your order.');
    if (imgs.some((i) => i.uploading)) return setError('Please wait for your photos to finish uploading.');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ orderCode, rating, comment, imageUrls: imgs.map((i) => i.url).filter(Boolean) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save your review. Please try again.');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your review. Please try again.');
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews?orderCode=${encodeURIComponent(orderCode)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await token()}` },
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError('Could not delete your review. Please try again.');
      setBusy(false);
    }
  }

  const shown = hover || rating;
  return (
    <div className="qr-modal-overlay" onClick={() => !busy && onClose()}>
      <div className="qr-modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className="qr-modal-close" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
        <h3 id="review-title">{existing ? 'Edit your review' : 'Leave a review'}</h3>
        <p className="review-for">{itemName} · {orderCode}</p>

        <div className="review-stars" role="radiogroup" aria-label="Rating" onPointerLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className={n <= shown ? 'on' : ''}
              onPointerEnter={() => setHover(n)}
              onClick={() => setRating(n)}
            >★</button>
          ))}
        </div>
        <p className="review-star-label">{shown ? LABELS[shown] : 'Tap to rate'}</p>

        <label className="field-label" htmlFor="review-text">Your message <span className="event-optional">Optional</span></label>
        <textarea
          id="review-text"
          className="field-input review-text"
          rows={4}
          maxLength={MAX_REVIEW_COMMENT}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How was your order? Fast delivery, easy payment…"
        />
        <p className="review-count">{comment.length}/{MAX_REVIEW_COMMENT}</p>

        <div className="review-imgs">
          {imgs.map((im) => (
            <div key={im.preview} className={`review-img${im.uploading ? ' uploading' : ''}`}>
              <img src={im.preview} alt="" />
              {!im.uploading && (
                <button type="button" aria-label="Remove photo" onClick={() => setImgs((l) => l.filter((x) => x.preview !== im.preview))}>✕</button>
              )}
            </div>
          ))}
          {imgs.length < MAX_REVIEW_IMAGES && (
            <label className="review-img-add" title="Add a photo">
              <span aria-hidden>＋</span>
              <small>Photo</small>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>

        {error && <p className="error-msg" style={{ margin: '10px 0 0' }}>{error}</p>}

        <div className="review-actions">
          {existing && (
            <button type="button" className="review-delete" onClick={remove} disabled={busy}>Delete review</button>
          )}
          <button type="button" className="submit-btn review-submit" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Post review'}
          </button>
        </div>
        <p className="field-hint" style={{ margin: '10px 0 0' }}>Your review is public and shows your first name and last initial.</p>
      </div>
    </div>
  );
}
