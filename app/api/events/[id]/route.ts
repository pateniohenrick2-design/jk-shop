import { prisma } from '@/lib/prisma';
import { uploadToR2 } from '@/lib/r2';
import { ensureEventSheet } from '@/lib/gsheet';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';
import { manilaStartOfDay } from '@/lib/manilaDate';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const name = (formData.get('name') as string)?.trim();
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const heroCount = parseInt((formData.get('heroCount') as string) || '0', 10);
  const scheduleCount = parseInt((formData.get('scheduleCount') as string) || '0', 10);

  if (!name || !startDate || !endDate || heroCount < 1) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const heroesData: { heroName: string; price: number; imageUrl: string | null }[] = [];
  for (let i = 0; i < heroCount; i++) {
    const heroName = (formData.get(`heroName_${i}`) as string)?.trim();
    const image = formData.get(`heroImage_${i}`) as File | null;
    const existingImageUrl = formData.get(`heroExistingImage_${i}`) as string | null;
    if (!heroName) continue;

    let imageUrl: string | null = existingImageUrl || null;
    if (image && image.size > 0) {
      imageUrl = await uploadToR2(image, 'events');
    }
    heroesData.push({ heroName, price: 0, imageUrl }); // price is set from the delivery schedule below
  }

  if (heroesData.length === 0) {
    return NextResponse.json({ error: 'At least one valid hero skin is required' }, { status: 400 });
  }

  const phases: { phaseName: string; startDate: Date; endDate: Date; soldOutAt: Date | null; pricesByHero: (number | null)[] }[] = [];
  for (let p = 0; p < scheduleCount; p++) {
    const phaseName = (formData.get(`phaseName_${p}`) as string)?.trim();
    const phaseStart = formData.get(`phaseStart_${p}`) as string;
    const phaseEnd = formData.get(`phaseEnd_${p}`) as string;
    if (!phaseName || !phaseStart || !phaseEnd) continue;
    // Optional: the day this phase becomes sold out for customers (Philippine time)
    const soldOutAt = manilaStartOfDay(formData.get(`phaseSoldOut_${p}`) as string | null);

    const pricesByHero: (number | null)[] = [];
    for (let h = 0; h < heroesData.length; h++) {
      const raw = formData.get(`schedulePrice_${p}_${h}`) as string | null;
      const parsed = raw ? parseFloat(raw) : NaN;
      pricesByHero.push(!isNaN(parsed) && parsed > 0 ? parsed : null);
    }
    phases.push({ phaseName, startDate: new Date(phaseStart), endDate: new Date(phaseEnd), soldOutAt, pricesByHero });
  }

  // Each hero's price = its cheapest delivery-schedule price (shown to customers as "From ₱…")
  const unpriced: string[] = [];
  heroesData.forEach((h, idx) => {
    const prices = phases.map((ph) => ph.pricesByHero[idx]).filter((n): n is number => n != null);
    if (prices.length) h.price = Math.min(...prices);
    else unpriced.push(h.heroName);
  });
  if (unpriced.length) {
    return NextResponse.json({ error: `Add a delivery schedule price for: ${unpriced.join(', ')}.` }, { status: 400 });
  }

  const basePrice = Math.min(...heroesData.map((h) => h.price));

  try {
    const event = await prisma.$transaction(async (tx) => {
      await tx.eventSchedule.deleteMany({ where: { eventId: params.id } });
      await tx.eventHero.deleteMany({ where: { eventId: params.id } });

      await tx.event.update({
        where: { id: params.id },
        data: { name, basePrice, startDate: new Date(startDate), endDate: new Date(endDate) },
      });

      const heroRecords = [];
      for (const h of heroesData) {
        const hero = await tx.eventHero.create({
          data: { eventId: params.id, heroName: h.heroName, price: h.price, imageUrl: h.imageUrl },
        });
        heroRecords.push(hero);
      }

      for (const phase of phases) {
        for (let h = 0; h < heroRecords.length; h++) {
          const price = phase.pricesByHero[h];
          if (price == null) continue;
          await tx.eventSchedule.create({
            data: {
              eventId: params.id,
              heroId: heroRecords[h].id,
              phaseName: phase.phaseName,
              startDate: phase.startDate,
              endDate: phase.endDate,
              soldOutAt: phase.soldOutAt,
              price,
            },
          });
        }
      }

      return tx.event.findUnique({
        where: { id: params.id },
        include: { heroes: { include: { schedule: true } } },
      });
    });

    // If the event was renamed, its orders now go to a tab with the new name — create it up front
    if (event) await ensureEventSheet(event.name);

    return NextResponse.json(event);
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update event.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.$transaction([
      prisma.eventSchedule.deleteMany({ where: { eventId: params.id } }),
      prisma.eventHero.deleteMany({ where: { eventId: params.id } }),
      prisma.event.delete({ where: { id: params.id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete — this event has existing customer orders tied to it.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Failed to delete event.' }, { status: 500 });
  }
}