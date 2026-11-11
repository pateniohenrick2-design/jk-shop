import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { getCustomer } from '@/lib/customerAuth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizeLabel, type SavedAccount } from '@/lib/savedAccounts';

// Accounts the customer removed, kept on their Supabase profile (app_metadata, which only the
// server can write): "<gameId>|<account key>" → ISO time it was removed.
type RemovedMap = Record<string, string>;
const MAX_REMOVED = 100;

function getRemoved(user: User): RemovedMap {
  const r = user.app_metadata?.removedSavedAccounts;
  return r && typeof r === 'object' ? (r as RemovedMap) : {};
}

// DELETE /api/saved-accounts  { gameId, key } — hide a saved account from the autofill list
export async function DELETE(req: NextRequest) {
  const customer = await getCustomer(req);
  if (!customer) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const gameId = typeof body?.gameId === 'string' ? body.gameId : '';
  const key = typeof body?.key === 'string' ? body.key : '';
  if (!gameId || !key || key.length > 1000) return NextResponse.json({ error: 'gameId and key are required.' }, { status: 400 });

  const removed = { ...getRemoved(customer), [`${gameId}|${key}`]: new Date().toISOString() };
  // Keep only the most recent removals so the profile can't grow without limit
  const trimmed = Object.fromEntries(
    Object.entries(removed).sort(([, a], [, b]) => b.localeCompare(a)).slice(0, MAX_REMOVED)
  );

  const { error } = await supabaseAdmin.auth.admin.updateUserById(customer.id, {
    app_metadata: { ...customer.app_metadata, removedSavedAccounts: trimmed },
  });
  if (error) return NextResponse.json({ error: 'Could not remove the account. Please try again.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET /api/saved-accounts?gameId=... — the account details a logged-in customer used on their
// previous orders for this game (newest first, duplicates merged), plus their last Facebook name.
export async function GET(req: NextRequest) {
  const customer = await getCustomer(req);
  if (!customer) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });

  const gameId = req.nextUrl.searchParams.get('gameId');
  if (!gameId) return NextResponse.json({ error: 'gameId is required.' }, { status: 400 });

  const orders = await prisma.order.findMany({
    where: {
      gameId,
      OR: [
        { customerId: customer.id },
        ...(customer.email ? [{ email: { equals: customer.email, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: {
      accountFields: true,
      facebookName: true,
      createdAt: true,
      category: { select: { fields: { orderBy: { sortOrder: 'asc' }, select: { id: true, label: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const removed = getRemoved(customer);
  const accounts: SavedAccount[] = [];
  const seen = new Set<string>();
  for (const o of orders) {
    const raw = (o.accountFields ?? {}) as Record<string, unknown>;
    const values: Record<string, string> = {};
    const display: { label: string; value: string }[] = [];
    for (const f of o.category.fields) {
      const value = String(raw[f.id] ?? '').trim();
      if (!value) continue;
      values[normalizeLabel(f.label)] = value;
      display.push({ label: f.label.replace(/^Enter\s+/i, ''), value });
    }
    if (display.length === 0) continue;
    const key = Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v.toLowerCase()}`).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    // Removed by the customer — stays hidden unless they order with it again afterwards
    const removedAt = removed[`${gameId}|${key}`];
    if (removedAt && removedAt >= o.createdAt.toISOString()) continue;
    accounts.push({ key, values, display, lastUsed: o.createdAt.toISOString() });
    if (accounts.length >= 5) break;
  }

  const facebookName = orders.find((o) => o.facebookName?.trim())?.facebookName?.trim() ?? '';
  return NextResponse.json({ accounts, facebookName }, { headers: { 'Cache-Control': 'no-store' } });
}
