import { createClient } from '@supabase/supabase-js';

// Server-side only (API routes) — use for file uploads, admin auth checks
// Never import this in a client component.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);