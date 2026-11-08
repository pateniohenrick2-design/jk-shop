import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
const TIMEZONE = 'Asia/Manila';

// Philippine calendar date parts for a moment in time
function phDate(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return { ymd: `${parts.year}-${parts.month}-${parts.day}`, mmdd: `${parts.month}${parts.day}` };
}

// Suggests a short unique code for a category: "Shop Items" → "SI" → "SHI", "Lunite" → "LUN".
// Generic names like "Order" use the game name instead ("Robux Plus" → "RP" → "ROP").
export async function generateCategoryCode(categoryName: string, gameName: string, db: Tx | typeof prisma = prisma) {
  const generic = /^(order|orders|main|items?)$/i.test(categoryName.trim());
  const source = generic ? gameName : categoryName;
  const words = source.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  let base = words.length >= 3 ? words.slice(0, 3).map((w) => w[0]).join('') : '';
  if (!base && words.length === 2) base = words[0].slice(0, 2) + words[1][0];
  if (!base) base = (words[0] ?? 'ORD').slice(0, 3);
  base = base.padEnd(3, 'X');

  let code = base;
  for (let i = 2; await db.category.findUnique({ where: { code } }); i++) code = `${base}${i}`;
  return code;
}

// Reserves the next order code for a category, e.g. "DIA-1108001" = 1st Diamonds order on Nov 8.
// Must run inside the transaction that creates the order, so a failed order doesn't burn a number.
export async function nextOrderCode(tx: Tx, categoryId: string, at: Date = new Date()) {
  const category = await tx.category.findUniqueOrThrow({ where: { id: categoryId }, include: { game: true } });
  let code = category.code;
  if (!code) {
    code = await generateCategoryCode(category.name, category.game.name, tx);
    await tx.category.update({ where: { id: categoryId }, data: { code } });
  }

  const { ymd, mmdd } = phDate(at);
  // Atomic increment: concurrent orders each get a different number
  const counter = await tx.orderCounter.upsert({
    where: { key: `${code}-${ymd}` },
    create: { key: `${code}-${ymd}`, seq: 1 },
    update: { seq: { increment: 1 } },
  });
  return `${code}-${mmdd}${String(counter.seq).padStart(3, '0')}`;
}
