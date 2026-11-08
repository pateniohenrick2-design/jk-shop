'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function PasswordInput({ value, onChange, autoComplete, placeholder }: {
  value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input className="field-input" type={show ? 'text' : 'password'} autoComplete={autoComplete}
        placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="password-toggle" onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

export default function AccountClient({ username, role }: { username: string; role: string }) {
  const router = useRouter();
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const usernameChanged = newUsername.trim() !== username;
  const wantsPassword = newPassword.length > 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!usernameChanged && !wantsPassword) return setMsg({ ok: false, text: 'Enter a new username or a new password.' });
    if (wantsPassword && newPassword.length < 8) return setMsg({ ok: false, text: 'New password must be at least 8 characters.' });
    if (wantsPassword && newPassword !== confirm) return setMsg({ ok: false, text: 'New passwords do not match.' });
    if (!currentPassword) return setMsg({ ok: false, text: 'Enter your current password to confirm the change.' });

    setSaving(true);
    try {
      const res = await fetch('/api/admin/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newUsername: usernameChanged ? newUsername.trim() : undefined,
          newPassword: wantsPassword ? newPassword : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save changes.');
      setNewPassword(''); setConfirm(''); setCurrentPassword('');
      setNewUsername(data.username);
      setMsg({
        ok: true,
        text: [usernameChanged && `Username changed to “${data.username}”`, wantsPassword && 'password updated'].filter(Boolean).join(' and ') + '. Use them next time you sign in.',
      });
      router.refresh(); // updates the name shown in the sidebar
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="admin-page-title">Account</h1>
      <p className="field-hint">Change the username and password you use to sign in to the admin.</p>

      <form className="panel account-card" onSubmit={save} noValidate>
        <div className="account-who">
          <span className="account-avatar">{username.charAt(0).toUpperCase() || '?'}</span>
          <div>
            <strong>{username}</strong>
            <span>{role === 'super_admin' ? 'Super Admin' : 'Staff'}</span>
          </div>
        </div>

        <h3 className="account-section">Username</h3>
        <label className="field-label" htmlFor="acc-username">Username</label>
        <input id="acc-username" className="field-input" autoComplete="username" value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)} />
        <p className="field-hint">3–32 characters: letters, numbers, dot, dash or underscore.</p>

        <h3 className="account-section">New password <span className="event-optional">Optional</span></h3>
        <label className="field-label">New password</label>
        <PasswordInput value={newPassword} onChange={setNewPassword} autoComplete="new-password" placeholder="Leave blank to keep your current password" />
        <label className="field-label">Confirm new password</label>
        <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />

        <div className="account-confirm">
          <label className="field-label">Current password <span style={{ color: '#e0c26a' }}>*</span></label>
          <PasswordInput value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" placeholder="Required to save changes" />
        </div>

        {msg && <p className={msg.ok ? 'pm-ok' : 'error-msg'}>{msg.text}</p>}
        <button className="submit-btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
