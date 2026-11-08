import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Reads the customer's Supabase login from "Authorization: Bearer <access token>".
// Returns null for guests or expired/invalid tokens — never throws.
export async function getCustomer(req: NextRequest): Promise<User | null> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(header.slice(7));
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}
