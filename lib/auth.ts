import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'jk_admin_session';

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me'
);

export type SessionPayload = {
  adminId: string;
  username: string;
  role: 'staff' | 'super_admin';
};

export async function createSessionToken(payload: SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}