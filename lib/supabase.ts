import { createClient } from '@supabase/supabase-js';

// Client-side (browser) — safe to expose, uses anon key
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
