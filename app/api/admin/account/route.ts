import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { verifySessionToken, createSessionToken, COOKIE_NAME } from '@/lib/auth';

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
const MIN_PASSWORD = 8;

// PATCH /api/admin/account — change the logged-in admin's username and/or password.
// Body: { currentPassword, newUsername?, newPassword? }
export async function PATCH(req: NextRequest) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword ?? '');
  const newUsername = typeof body.newUsername === 'string' ? body.newUsername.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  const admin = await prisma.admin.findUnique({ where: { id: session.adminId } });
  if (!admin) return NextResponse.json({ error: 'Account not found. Please log in again.' }, { status: 401 });

  if (!currentPassword || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 400 });
  }

  const data: { username?: string; passwordHash?: string } = {};

  if (newUsername && newUsername !== admin.username) {
    if (!USERNAME_RE.test(newUsername)) {
      return NextResponse.json({ error: 'Username must be 3–32 characters: letters, numbers, dot, dash or underscore.' }, { status: 400 });
    }
    const taken = await prisma.admin.findUnique({ where: { username: newUsername } });
    if (taken) return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
    data.username = newUsername;
  }

  if (newPassword) {
    if (newPassword.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `New password must be at least ${MIN_PASSWORD} characters.` }, { status: 400 });
    }
    if (await bcrypt.compare(newPassword, admin.passwordHash)) {
      return NextResponse.json({ error: 'New password must be different from your current one.' }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (!data.username && !data.passwordHash) {
    return NextResponse.json({ error: 'Nothing to change — enter a new username or a new password.' }, { status: 400 });
  }

  const updated = await prisma.admin.update({ where: { id: admin.id }, data });

  // Refresh the login cookie so the new username shows right away (and you stay signed in)
  const res = NextResponse.json({ ok: true, username: updated.username });
  res.cookies.set(
    COOKIE_NAME,
    await createSessionToken({ adminId: updated.id, username: updated.username, role: updated.role }),
    { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 },
  );
  return res;
}
