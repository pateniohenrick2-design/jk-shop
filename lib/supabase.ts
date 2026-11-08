import { createClient } from '@supabase/supabase-js';

// Client-side (browser) — safe to expose, uses anon key.
// Also handles customer login (email code + Google): the session is kept in the browser
// and refreshed automatically. PKCE flow = the Google redirect returns a one-time ?code=
// that only this browser can exchange, instead of putting tokens in the URL.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
