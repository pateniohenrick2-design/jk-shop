import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/adminSession';

// PATCH /api/admin/reviews/:id  { hidden?: boolean, adminReply?: string | null }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.hidden === 'boolean') data.hidden = body.hidden;
  if (body.adminReply !== undefined) {
    const reply = typeof body.adminReply === 'string' ? body.adminReply.trim().slice(0, 500) : '';
    data.adminReply = reply || null;
    data.repliedAt = reply ? new Date() : null;
  }
  const review = await prisma.review.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, hidden: review.hidden, adminReply: review.adminReply });
}
