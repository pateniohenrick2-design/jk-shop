import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME, type SessionPayload } from '@/lib/auth';

// The logged-in admin for an /api/admin route, or null. (The /admin middleware doesn't cover /api.)
export async function getAdminSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}
