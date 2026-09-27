import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { noteText } = await req.json();
  if (!noteText || !noteText.trim()) {
    return NextResponse.json({ error: 'Note text is required' }, { status: 400 });
  }

  const note = await prisma.orderNote.create({
    data: { orderId: params.id, adminId: session.adminId, noteText: noteText.trim() },
    include: { admin: { select: { username: true } } },
  });

  return NextResponse.json(note);
}