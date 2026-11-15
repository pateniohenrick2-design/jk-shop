import { prisma } from '@/lib/prisma';

import { linkedDiamondName } from '@/lib/linkedPrices.shared';

export { linkedDiamondName };

const norm = (s: string) => s.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ').trim();

// Copies the current Diamonds prices onto every linked item in that game.
// Safe to call often: only writes when a price actually differs. Never throws.
export async function syncLinkedPrices(gameId: string): Promise<number> {
  try {
    const items = await prisma.pricelistItem.findMany({
      where: { category: { gameId } },
      select: { id: true, name: true, price: true, category: { select: { name: true } } },
    });
    const diamondPrice = new Map<string, number>();
    for (const it of items) {
      if (it.category.name.trim().toLowerCase() === 'diamonds') diamondPrice.set(norm(it.name), Number(it.price));
    }
    let changed = 0;
    for (const it of items) {
      const target = linkedDiamondName(it.name);
      if (!target) continue;
      const price = diamondPrice.get(norm(target));
      if (price === undefined || price === Number(it.price)) continue;
      await prisma.pricelistItem.update({ where: { id: it.id }, data: { price } });
      changed++;
    }
    return changed;
  } catch (err) {
    console.error('[linkedPrices] sync failed for game', gameId, err);
    return 0;
  }
}

// Same, for the game an item / category belongs to
export async function syncLinkedPricesForCategory(categoryId: string) {
  const cat = await prisma.category.findUnique({ where: { id: categoryId }, select: { gameId: true } }).catch(() => null);
  return cat ? syncLinkedPrices(cat.gameId) : 0;
}
