import { NextRequest, NextResponse } from 'next/server';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// POST /api/sheet-sync — called by the Google Sheet (scripts/google-apps-script/SheetSync.gs)
// when an order's Status is changed there. Body: { secret, orderCode, status }
// or { secret, changes: [{ orderCode, status }, ...] } for several rows at once.

// Sheet wording → website status (case-insensitive, first match wins — same words as the sheet colours)
const STATUS_RULES: [RegExp, OrderStatus][] = [
  [/refund/i, 'refund'],
  // Event Skin Gifting tabs: PENDING / RESERVED / FRIENDS / DELIVERED / FAILED
  [/reserv/i, 'reserved'],
  [/friend/i, 'friends'],
  [/fail|cancel|invalid|wrong/i, 'failed'],
  // The website's "finished" status is Successful, so Done/Sent/Delivered all land there
  [/success|complete|done|deliver|\bsent\b/i, 'successful'],
  [/progress|processing|ongoing|sending/i, 'in_progress'],
  [/pending|unpaid|waiting|to process/i, 'pending'],
];

function toStatus(word: unknown): OrderStatus | null {
  const s = String(word ?? '').trim();
  if (!s) return null;
  return STATUS_RULES.find(([re]) => re.test(s))?.[1] ?? null;
}

type Change = { orderCode?: string; status?: string };

export async function POST(req: NextRequest) {
  const secret = process.env.GSHEET_WEBHOOK_SECRET;
  let body: { secret?: string; changes?: Change[] } & Change;
  try {
    body = JSON.parse(await req.text()); // Apps Script may send text/plain
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  if (!secret || body.secret !== secret) {
    return NextResponse.json({ ok: false, error: 'Bad secret' }, { status: 401 });
  }

  const changes: Change[] = Array.isArray(body.changes) ? body.changes.slice(0, 200) : [body];
  const results: { orderCode: string; result: string }[] = [];

  try {
  for (const c of changes) {
    const orderCode = String(c.orderCode ?? '').trim();
    if (!orderCode) continue;
    const status = toStatus(c.status);
    if (!status) { results.push({ orderCode, result: `ignored: unknown status "${c.status ?? ''}"` }); continue; }

    const order = await prisma.order.findFirst({ where: { orderCode }, select: { id: true, status: true } });
    if (!order) { results.push({ orderCode, result: 'not found' }); continue; }
    if (order.status === status) { results.push({ orderCode, result: `unchanged (${status})` }); continue; }

    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status } }),
      prisma.orderStatusHistory.create({ data: { orderId: order.id, oldStatus: order.status, newStatus: status } }),
    ]);
    results.push({ orderCode, result: `${order.status} → ${status}` });
  }

  } catch (err) {
    // Shows in Vercel → Logs, and the reason goes back to the Apps Script log
    console.error('[sheet-sync] failed', err);
    return NextResponse.json({ ok: false, error: String((err as Error)?.message ?? err).slice(0, 500), results }, { status: 500 });
  }

  return NextResponse.json({ ok: true, results });
}
