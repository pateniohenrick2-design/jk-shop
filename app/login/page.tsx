'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useCustomer, safeNext } from '@/lib/useCustomer';
import OtpInput, { type OtpInputHandle } from '@/components/OtpInput';

type Mode = 'signin' | 'register';
type SignInMethod = 'password' | 'code';
// form: the main form · verify: enter emailed code · forgot: ask for email to reset
// reset-verify: enter reset code · new-password: choose a new password
type Step = 'form' | 'verify' | 'forgot' | 'reset-verify' | 'new-password';
type VerifyType = 'email' | 'signup' | 'recovery';

const RESEND_SECONDS = 60;
const MIN_PASSWORD = 8;
// Must match Supabase → Authentication → Email → "Email OTP Length" (currently 8)
const OTP_LENGTH = Number(process.env.NEXT_PUBLIC_OTP_LENGTH || 8);

// Turns Supabase's technical errors into something a customer understands
function friendlyError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('signups not allowed') || m.includes('user not found')) return 'No account found with this email. Please register first.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Please log in.';
  if (m.includes('only request this after') || m.includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('should be different')) return 'Your new password must be different from your old one.';
  if (m.includes('password') && (m.includes('at least') || m.includes('weak') || m.includes('characters'))) return msg;
  if (m.includes('expired') || m.includes('invalid')) return 'That code is wrong or has expired. Check your email or resend a new code.';
  if (m.includes('sending') && m.includes('email')) return "We couldn't send the email right now. Please try again in a few minutes.";
  if (m.includes('provider is not enabled')) return 'Google sign-in is not available yet. Please use your email instead.';
  return msg;
}

function PasswordInput({
  id, value, onChange, autoComplete, placeholder,
}: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input
        id={id}
        className="field-input"
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="password-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const fromResetLink = params.get('reset') === '1';
  const { user, loading } = useCustomer();

  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'signin');
  const [method, setMethod] = useState<SignInMethod>('password');
  const [step, setStep] = useState<Step>(fromResetLink ? 'new-password' : 'form');
  const [verifyType, setVerifyType] = useState<VerifyType>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const codeRef = useRef<OtpInputHandle>(null);
  // While resetting a password the customer is briefly signed in — don't bounce them away
  const holdRedirect = useRef(fromResetLink);

  useEffect(() => {
    if (!loading && user && !holdRedirect.current) router.replace(next);
  }, [loading, user, next, router]);

  // Opened the reset link but the session didn't come through (expired / other browser)
  useEffect(() => {
    if (fromResetLink && !loading && !user) {
      holdRedirect.current = false;
      setStep('forgot');
      setError('That reset link has expired. Enter your email to get a new code.');
    }
  }, [fromResetLink, loading, user]);

  // Only show the Google button if Google sign-in is switched on in Supabase
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    })
      .then((r) => r.json())
      .then((s) => setGoogleEnabled(!!s?.external?.google))
      .catch(() => setGoogleEnabled(false));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'verify' || step === 'reset-verify') codeRef.current?.focus();
  }, [step]);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  function reset(to: Step = 'form') {
    setStep(to);
    setCode('');
    setPassword('');
    setConfirm('');
    setError(null);
    setInfo(null);
  }

  function switchMode(m: Mode) {
    setMode(m);
    reset();
  }

  function goToCode(type: VerifyType, to: Step, message: string) {
    setVerifyType(type);
    setStep(to);
    setCode('');
    setCooldown(RESEND_SECONDS);
    setInfo(message);
  }

  function validEmail() {
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setError('Please enter a valid email address.');
      return null;
    }
    setEmail(clean);
    return clean;
  }

  // ---- Log in with password ----
  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    const clean = validEmail();
    if (!clean) return;
    if (!password) return setError('Please enter your password.');

    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: clean, password });
    if (err && err.message.toLowerCase().includes('email not confirmed')) {
      // Registered but never verified: send a fresh code and let them verify now
      const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email: clean, options: { emailRedirectTo: redirectTo() } });
      setBusy(false);
      if (resendErr) return setError(friendlyError(resendErr.message));
      return goToCode('signup', 'verify', `Your email isn't verified yet. We sent a code to ${clean}.`);
    }
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    router.replace(next);
  }

  // ---- Log in with an emailed code (no password) ----
  async function sendLoginCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null); setInfo(null);
    const clean = validEmail();
    if (!clean) return;
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo() },
    });
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    goToCode('email', 'verify', `We sent a login code to ${clean}. Check your inbox (and spam folder).`);
  }

  // ---- Register with password, then verify email with a code ----
  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!name.trim()) return setError('Please enter your name.');
    const clean = validEmail();
    if (!clean) return;
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('Passwords do not match.');

    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: clean,
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo() },
    });
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    if (data.session) return router.replace(next); // email confirmation turned off in Supabase
    // Supabase hides whether an email is taken: an existing account comes back with no identities
    if (data.user && data.user.identities?.length === 0) {
      return setError('An account with this email already exists. Please log in (or use "Forgot password").');
    }
    goToCode('signup', 'verify', `Almost done! We sent a verification code to ${clean}.`);
  }

  // ---- Enter the emailed code (login code or signup verification) ----
  async function verifyCode(e?: React.FormEvent, fullCode?: string) {
    e?.preventDefault();
    setError(null);
    const token = (fullCode ?? code).replace(/\D/g, '');
    if (token.length < OTP_LENGTH) return setError(`Enter all ${OTP_LENGTH} digits from your email.`);
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: verifyType === 'recovery' ? 'recovery' : verifyType });
    setBusy(false);
    if (err) {
      if (verifyType === 'recovery') holdRedirect.current = false;
      return setError(friendlyError(err.message));
    }
    if (verifyType === 'recovery') {
      setInfo(null);
      setStep('new-password');
      return;
    }
    router.replace(next);
  }

  async function resendCode() {
    setError(null);
    setBusy(true);
    let err;
    if (verifyType === 'signup') {
      ({ error: err } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo() } }));
    } else if (verifyType === 'recovery') {
      ({ error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetRedirect() }));
    } else {
      ({ error: err } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo() } }));
    }
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setCooldown(RESEND_SECONDS);
    setInfo(`We sent a new code to ${email}.`);
  }

  // ---- Forgot password ----
  const resetRedirect = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/login?reset=1&next=${encodeURIComponent(next)}`)}`;

  async function sendResetCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    const clean = validEmail();
    if (!clean) return;
    setBusy(true);
    holdRedirect.current = true;
    const { error: err } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo: resetRedirect() });
    setBusy(false);
    if (err) { holdRedirect.current = false; return setError(friendlyError(err.message)); }
    goToCode('recovery', 'reset-verify', `If an account exists for ${clean}, we sent a reset code. Check your inbox (and spam folder).`);
  }

  async function saveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    holdRedirect.current = false;
    router.replace(next);
  }

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
    if (err) { setBusy(false); setError(friendlyError(err.message)); }
  }

  // ---------- UI ----------
  const titles: Record<Step, [string, string]> = {
    form: mode === 'signin'
      ? ['Welcome back', 'Log in to fill in your email automatically when you order.']
      : ['Create your account', 'Register with your email and a password. We’ll send a code to verify your email.'],
    verify: [verifyType === 'signup' ? 'Verify your email' : 'Enter your login code', ''],
    forgot: ['Forgot your password?', 'Enter your account email and we’ll send you a code to reset it.'],
    'reset-verify': ['Check your email', ''],
    'new-password': ['Set a new password', 'Choose a new password for your account.'],
  };
  const [title, subtitle] = titles[step];

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>{title}</h1>
        {subtitle && <p className="login-sub">{subtitle}</p>}

        {step === 'form' && (
          <div className="login-tabs" role="tablist">
            <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')}>Log in</button>
            <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Register</button>
          </div>
        )}

        {googleEnabled && step === 'form' && (
          <>
            <button className="google-btn" onClick={signInWithGoogle} disabled={busy}>
              <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Continue with Google
            </button>
            <div className="login-divider"><span>or use your email</span></div>
          </>
        )}

        {error && <p className="error-msg">{error}</p>}
        {info && !error && <p className="login-info">{info}</p>}

        {/* Log in — password */}
        {step === 'form' && mode === 'signin' && method === 'password' && (
          <form onSubmit={signInWithPassword} noValidate>
            <label className="field-label" htmlFor="login-email">Email</label>
            <input id="login-email" className="field-input" type="email" autoComplete="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            <div className="login-label-row">
              <label className="field-label" htmlFor="login-password">Password</label>
              <button type="button" className="login-link login-small" onClick={() => reset('forgot')}>Forgot password?</button>
            </div>
            <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
            <button className="submit-btn" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
            <button type="button" className="login-alt-btn" onClick={() => { setMethod('code'); setError(null); }}>
              Log in with an email code instead
            </button>
          </form>
        )}

        {/* Log in — emailed code */}
        {step === 'form' && mode === 'signin' && method === 'code' && (
          <form onSubmit={sendLoginCode} noValidate>
            <label className="field-label" htmlFor="login-email">Email</label>
            <input id="login-email" className="field-input" type="email" autoComplete="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            <button className="submit-btn" type="submit" disabled={busy}>{busy ? 'Sending code…' : 'Send login code'}</button>
            <button type="button" className="login-alt-btn" onClick={() => { setMethod('password'); setError(null); }}>
              Log in with password instead
            </button>
          </form>
        )}

        {/* Register */}
        {step === 'form' && mode === 'register' && (
          <form onSubmit={register} noValidate>
            <label className="field-label" htmlFor="login-name">Full name</label>
            <input id="login-name" className="field-input" autoComplete="name" placeholder="Juan Dela Cruz" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <label className="field-label" htmlFor="login-email">Email</label>
            <input id="login-email" className="field-input" type="email" autoComplete="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="field-label" htmlFor="login-password">Password</label>
            <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD} characters`} />
            <label className="field-label" htmlFor="login-confirm">Confirm password</label>
            <PasswordInput id="login-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            <button className="submit-btn" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
          </form>
        )}

        {/* Forgot password — ask for email */}
        {step === 'forgot' && (
          <form onSubmit={sendResetCode} noValidate>
            <label className="field-label" htmlFor="login-email">Email</label>
            <input id="login-email" className="field-input" type="email" autoComplete="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            <button className="submit-btn" type="submit" disabled={busy}>{busy ? 'Sending code…' : 'Send reset code'}</button>
            <button type="button" className="login-alt-btn" onClick={() => reset('form')}>← Back to log in</button>
          </form>
        )}

        {/* Enter emailed code (login / signup verification / password reset) */}
        {(step === 'verify' || step === 'reset-verify') && (
          <form onSubmit={verifyCode} noValidate>
            <label className="field-label">Verification code</label>
            <OtpInput
              ref={codeRef}
              length={OTP_LENGTH}
              value={code}
              onChange={setCode}
              onComplete={(full) => { if (!busy) verifyCode(undefined, full); }}
              disabled={busy}
            />
            <p className="otp-hint">Tip: copy the code from the email and paste it into the first box.</p>
            <button className="submit-btn" type="submit" disabled={busy}>
              {busy ? 'Verifying…' : verifyType === 'signup' ? 'Verify & create account' : verifyType === 'recovery' ? 'Continue' : 'Verify & log in'}
            </button>
            <div className="login-code-actions">
              <button type="button" className="login-link" onClick={() => { holdRedirect.current = false; reset(step === 'reset-verify' ? 'forgot' : 'form'); }}>
                ← Use a different email
              </button>
              <button type="button" className="login-link" disabled={cooldown > 0 || busy} onClick={resendCode}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {/* New password after reset */}
        {step === 'new-password' && (
          <form onSubmit={saveNewPassword} noValidate>
            <label className="field-label" htmlFor="new-password">New password</label>
            <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD} characters`} />
            <label className="field-label" htmlFor="new-confirm">Confirm new password</label>
            <PasswordInput id="new-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            <button className="submit-btn" type="submit" disabled={busy || loading}>{busy ? 'Saving…' : 'Save password & continue'}</button>
          </form>
        )}

        {step === 'form' && (
          <>
            <p className="login-foot">
              {mode === 'signin' ? (
                <>No account yet? <button className="login-link" onClick={() => switchMode('register')}>Register</button></>
              ) : (
                <>Already have an account? <button className="login-link" onClick={() => switchMode('signin')}>Log in</button></>
              )}
            </p>
            <p className="login-foot" style={{ marginTop: 4 }}>
              <Link href={next} className="login-link">Continue without an account</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<div className="login-wrap" />}>
        <LoginInner />
      </Suspense>
    </>
  );
}
