import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/adminSession';

// POST /api/admin/categories/:id/icon  { iconUrl: string | null, onlyEmpty?: boolean }
// Sets (or clears) the icon of every item in the category at once.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { iconUrl, onlyEmpty } = await req.json();
  if (iconUrl !== null && iconUrl !== '' && (typeof iconUrl !== 'string' || !/^https?:\/\//.test(iconUrl))) {
    return NextResponse.json({ error: 'Invalid icon URL' }, { status: 400 });
  }
  const res = await prisma.pricelistItem.updateMany({
    where: { categoryId: params.id, ...(onlyEmpty ? { iconUrl: null } : {}) },
    data: { iconUrl },
  });
  return NextResponse.json({ ok: true, updated: res.count });
}
