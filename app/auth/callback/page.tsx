'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { safeNext } from '@/lib/useCustomer';

// Google sign-in (and the link in the verification email) land here with ?code=...
// The Supabase client exchanges that code for a session on its own (detectSessionInUrl),
// so this page just waits for the session and sends the customer back where they were.
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const next = safeNext(params.get('next'));
    const errorDesc = params.get('error_description') || params.get('error');
    if (errorDesc) {
      router.replace(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(errorDesc)}`);
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      router.replace(next);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) finish();
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) finish(); });

    // If nothing happens (expired/used link, opened in another browser), go to login with a message
    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        router.replace(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent('That sign-in link has expired or was opened in a different browser. Please try again.')}`);
      }
    }, 8000);

    return () => { sub.subscription.unsubscribe(); clearTimeout(timeout); };
  }, [params, router]);

  return <p className="login-callback">Signing you in…</p>;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p className="login-callback">Signing you in…</p>}>
      <CallbackInner />
    </Suspense>
  );
}
