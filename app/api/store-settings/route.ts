import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/adminSession';
import { withDefaults } from '@/lib/storeSettings';

export const dynamic = 'force-dynamic';

// GET /api/store-settings — public: open/closed status + footer contact details
export async function GET() {
  const row = await prisma.storeSettings.findUnique({ where: { id: 1 } }).catch(() => null);
  return NextResponse.json(withDefaults(row), {
    // Shared by every visitor; a status change shows up within ~15 seconds
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' },
  });
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

// PATCH /api/store-settings — admin only
export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (typeof body.isOpen === 'boolean') data.isOpen = body.isOpen;
  const closedMessage = clean(body.closedMessage, 300);
  if (closedMessage !== undefined) data.closedMessage = closedMessage || null;
  const contactLabel = clean(body.contactLabel, 60);
  if (contactLabel !== undefined) data.contactLabel = contactLabel || null;
  const replyTime = clean(body.replyTime, 120);
  if (replyTime !== undefined) data.replyTime = replyTime || null;
  const contactUrl = clean(body.contactUrl, 500);
  if (contactUrl !== undefined) {
    if (contactUrl && !/^https:\/\/[^\s]+$/i.test(contactUrl)) {
      return NextResponse.json({ error: 'The link must start with https:// (e.g. https://m.me/yourpage).' }, { status: 400 });
    }
    data.contactUrl = contactUrl || null;
  }

  const row = await prisma.storeSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  return NextResponse.json(withDefaults(row));
}
