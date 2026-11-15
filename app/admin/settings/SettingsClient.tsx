'use client';

import { useState } from 'react';
import type { StoreSettingsData } from '@/lib/storeSettings';

export default function SettingsClient({ initial, saved }: { initial: StoreSettingsData; saved: boolean }) {
  const [s, setS] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState<'status' | 'details' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save(patch: Partial<StoreSettingsData>, which: 'status' | 'details', msg: string) {
    setBusy(which);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/store-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save. Please try again.');
      setS(body);
      setDraft((d) => ({ ...d, ...patch, ...(which === 'details' ? body : {}) }));
      setNotice(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const detailsChanged =
    draft.closedMessage !== s.closedMessage ||
    draft.contactUrl !== s.contactUrl ||
    draft.contactLabel !== s.contactLabel ||
    draft.replyTime !== s.replyTime;
  const inboxLink = /facebook\.com\/messages\//i.test(draft.contactUrl);

  return (
    <div className="settings">
      <h1 className="admin-page-title">Store Settings</h1>
      <p className="field-hint">What customers see across the website. Changes show up within about 15 seconds.</p>

      {notice && <div className="bulk-notice" onClick={() => setNotice(null)}>{notice}</div>}
      {error && <p className="error-msg">{error}</p>}

      {/* Open / closed */}
      <section className={`panel settings-status ${s.isOpen ? 'is-open' : 'is-closed'}`}>
        <div className="settings-status-row">
          <div>
            <h2 className="dash-h2" style={{ marginBottom: 4 }}>Store status</h2>
            <p className="settings-status-text">
              <span className={`store-dot ${s.isOpen ? 'open' : 'closed'}`} aria-hidden />
              {s.isOpen ? 'Open: customers see "Open now".' : 'Closed: customers see a "We\'re closed" notice on every page.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={s.isOpen}
            aria-label="Store open"
            className={`cat-avail-switch settings-switch${s.isOpen ? ' on' : ''}`}
            disabled={busy !== null}
            onClick={() => save({ isOpen: !s.isOpen }, 'status', s.isOpen ? 'Store set to CLOSED.' : 'Store set to OPEN.')}
          >
            <span className="cat-avail-knob" />
          </button>
        </div>
        <p className="field-hint" style={{ margin: '10px 0 0' }}>
          Customers can still place orders while closed. They&apos;re told you&apos;ll process them when you&apos;re back.
        </p>
      </section>

      {/* Details */}
      <section className="panel">
        <h2 className="dash-h2">Messages &amp; footer links</h2>

        <label className="field-label" htmlFor="st-closed">Message while closed</label>
        <textarea
          id="st-closed"
          className="field-input settings-textarea"
          rows={2}
          maxLength={300}
          value={draft.closedMessage}
          onChange={(e) => setDraft({ ...draft, closedMessage: e.target.value })}
          placeholder="e.g. We're closed today. Orders will be processed tomorrow at 9AM."
        />

        <label className="field-label" htmlFor="st-url">Facebook / Messenger link</label>
        <input
          id="st-url"
          className="field-input"
          type="url"
          inputMode="url"
          value={draft.contactUrl}
          onChange={(e) => setDraft({ ...draft, contactUrl: e.target.value })}
          placeholder="https://m.me/yourpage  or  https://www.facebook.com/yourpage"
        />
        {inboxLink ? (
          <p className="field-hint settings-warn">
            ⚠ This is a chat from your own Messenger inbox, so customers can&apos;t open it. Use your page link
            (https://www.facebook.com/yourpage) or https://m.me/yourpage instead.
          </p>
        ) : (
          <p className="field-hint">Used by the footer&apos;s &quot;Message us&quot; button and link.</p>
        )}

        <div className="settings-two">
          <div>
            <label className="field-label" htmlFor="st-label">Button text</label>
            <input id="st-label" className="field-input" maxLength={60} value={draft.contactLabel} onChange={(e) => setDraft({ ...draft, contactLabel: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="st-reply">Reply time</label>
            <input id="st-reply" className="field-input" maxLength={120} value={draft.replyTime} onChange={(e) => setDraft({ ...draft, replyTime: e.target.value })} />
          </div>
        </div>

        <div className="settings-actions">
          {draft.contactUrl && (
            <a href={draft.contactUrl} target="_blank" rel="noopener noreferrer" className="pl-btn">Test link ↗</a>
          )}
          <button type="button" className="pl-btn" disabled={!detailsChanged || busy !== null} onClick={() => setDraft(s)}>Undo changes</button>
          <button
            type="button"
            className="pl-btn pl-btn-primary"
            disabled={!detailsChanged || busy !== null}
            onClick={() => save(
              { closedMessage: draft.closedMessage, contactUrl: draft.contactUrl, contactLabel: draft.contactLabel, replyTime: draft.replyTime },
              'details',
              'Saved. The footer and closed message are updated.',
            )}
          >
            {busy === 'details' ? 'Saving…' : 'Save'}
          </button>
        </div>
        {!saved && <p className="field-hint" style={{ marginTop: 10 }}>Showing the built-in defaults. Nothing has been saved yet.</p>}
      </section>
    </div>
  );
}
