'use client';

import { useState } from 'react';
import PaymentLogo from '@/components/PaymentLogo';

type Method = {
  id: string;
  name: string;
  accountName: string;
  accountNumber: string;
  qrImageUrl: string | null;
  logoUrl: string | null;
  isActive: boolean;
};

const proxied = (key: string) => `/api/image-proxy?key=${encodeURIComponent(key)}`;

export default function PaymentsClient({ initialMethods }: { initialMethods: Method[] }) {
  const [methods, setMethods] = useState(initialMethods);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="events-page-head">
        <div>
          <h1 className="admin-page-title">Payment Methods</h1>
          <p className="field-hint" style={{ margin: 0 }}>Shown at checkout. Upload each method’s QR code and logo; hide a method to stop offering it.</p>
        </div>
        {!adding && <button className="pl-btn pl-btn-primary" onClick={() => setAdding(true)}>+ Add Payment Method</button>}
      </div>

      <div className="pm-grid">
        {adding && (
          <PaymentCard
            key="new"
            method={null}
            onCancel={() => setAdding(false)}
            onSaved={(created) => {
              setMethods((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
              setAdding(false);
            }}
          />
        )}
        {methods.map((m) => (
          <PaymentCard
            key={m.id}
            method={m}
            onSaved={(updated) => setMethods((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
            onDeleted={() => setMethods((prev) => prev.filter((x) => x.id !== m.id))}
          />
        ))}
      </div>
      {methods.length === 0 && !adding && <p className="pl-empty">No payment methods yet. Click <strong>+ Add Payment Method</strong>.</p>}
    </div>
  );
}

// One card = edit an existing method, or (method === null) add a new one
function PaymentCard({
  method, onSaved, onDeleted, onCancel,
}: {
  method: Method | null;
  onSaved: (m: Method) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}) {
  const isNew = method === null;
  const [name, setName] = useState(method?.name ?? '');
  const [accountName, setAccountName] = useState(method?.accountName ?? '');
  const [accountNumber, setAccountNumber] = useState(method?.accountNumber ?? '');
  const [isActive, setIsActive] = useState(method?.isActive ?? true);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const shownQr = qrPreview ?? (method?.qrImageUrl && !removeQr ? proxied(method.qrImageUrl) : null);
  const logoKey = removeLogo ? null : method?.logoUrl ?? null;
  const dirty = isNew || name !== method.name || accountName !== method.accountName || accountNumber !== method.accountNumber ||
    isActive !== method.isActive || !!qrFile || removeQr || !!logoFile || removeLogo;

  function pickQr(file: File | null) {
    setQrFile(file); setQrPreview(file ? URL.createObjectURL(file) : null); setRemoveQr(false); setMessage(null);
  }
  function pickLogo(file: File | null) {
    setLogoFile(file); setLogoPreview(file ? URL.createObjectURL(file) : null); setRemoveLogo(false); setMessage(null);
  }

  async function save() {
    if (!name.trim() || !accountName.trim() || !accountNumber.trim()) {
      setMessage({ type: 'err', text: 'Name, account name and account number are required.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('accountName', accountName.trim());
      fd.append('accountNumber', accountNumber.trim());
      fd.append('isActive', String(isActive));
      if (qrFile) fd.append('qrImage', qrFile); else if (removeQr) fd.append('removeQr', 'true');
      if (logoFile) fd.append('logoImage', logoFile); else if (removeLogo) fd.append('removeLogo', 'true');

      const res = await fetch(isNew ? '/api/admin/payment-methods' : `/api/admin/payment-methods/${method.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save.');
      onSaved(data);
      if (!isNew) {
        pickQr(null); pickLogo(null); setRemoveQr(false); setRemoveLogo(false);
        setMessage({ type: 'ok', text: 'Saved.' });
      }
    } catch (err: any) {
      setMessage({ type: 'err', text: err.message || 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!method) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/payment-methods/${method.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete.');
      onDeleted?.();
    } catch (err: any) {
      setMessage({ type: 'err', text: err.message || 'Failed to delete.' });
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`panel pm-card ${isNew ? 'pm-card-new' : ''}`}>
      <div className="pm-card-head">
        <label className="pm-logo-pick" title="Click to upload a logo">
          <PaymentLogo name={name || 'New'} logoUrl={logoKey} previewUrl={logoPreview} />
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickLogo(e.target.files?.[0] ?? null)} />
        </label>
        <h3>{isNew ? 'New payment method' : method.name}</h3>
        <label className="pm-toggle">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>{isActive ? 'Shown at checkout' : 'Hidden'}</span>
        </label>
      </div>
      <p className="pm-logo-hint">
        Click the logo to {logoKey || logoPreview ? 'replace it' : 'upload one'}
        {(logoKey || logoPreview) && (
          <> · <button type="button" className="pm-link-btn pm-inline" onClick={() => (logoFile ? pickLogo(null) : setRemoveLogo(true))}>remove</button></>
        )}
      </p>

      <label className="pm-qr-drop" title={shownQr ? 'Click to replace QR' : 'Click to upload QR'}>
        {shownQr ? <img src={shownQr} alt={`${name} QR`} /> : <span>+ Upload QR code<br /><small>PNG, JPG or WebP · max 5MB</small></span>}
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickQr(e.target.files?.[0] ?? null)} />
      </label>
      {shownQr && (
        <button type="button" className="pm-link-btn" onClick={() => (qrFile ? pickQr(null) : setRemoveQr(true))}>Remove QR</button>
      )}

      <label className="field-label">Name</label>
      <input className="field-input" placeholder="e.g. GoTyme" value={name} onChange={(e) => setName(e.target.value)} autoFocus={isNew} />
      <label className="field-label">Account Name</label>
      <input className="field-input" placeholder="e.g. J.K.C." value={accountName} onChange={(e) => setAccountName(e.target.value)} />
      <label className="field-label">Account Number</label>
      <input className="field-input" placeholder="e.g. 09xxxxxxxxx" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />

      {message && <p className={message.type === 'ok' ? 'pm-ok' : 'error-msg'}>{message.text}</p>}

      <div className="pm-actions">
        {isNew ? (
          <button className="event-secondary-btn" disabled={saving} onClick={onCancel}>Cancel</button>
        ) : confirmDelete ? (
          <span className="pm-confirm">
            Delete {method.name}?
            <button className="pm-link-btn pm-inline" disabled={saving} onClick={remove}>Yes, delete</button>
            <button className="pm-link-btn pm-inline pm-muted" onClick={() => setConfirmDelete(false)}>Keep</button>
          </span>
        ) : (
          <button className="pm-delete-btn" disabled={saving} onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
        <button className="submit-btn pm-save" disabled={saving || !dirty} onClick={save}>
          {saving ? 'Saving...' : isNew ? 'Add Method' : 'Save'}
        </button>
      </div>
    </div>
  );
}
