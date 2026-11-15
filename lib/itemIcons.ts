// Picks an item icon from /public/items/<folder>/ based on the item's name. Returns null when none fits.
// To add one: drop the image in the game's folder and add a [name pattern, file] line below.

type Rules = { folder: string; rules: [RegExp, string][] };

const GAMES: Record<string, Rules> = {
  // key = the game's slug (same as its picture in /public/games/<slug>.png)
  mlbb: {
    folder: 'mlbb',
    rules: [
      [/weekly diamond pass|^wdp\b/i, 'wdp.png'],
      [/via recharge/i, 'dias.png'],
      [/premium starlight/i, 'psl.png'],
      [/starlight/i, 'nsl.png'],
      [/flag change/i, 'flag-change.png'],
      [/squad rename/i, 'squadrename.png'],
      [/rename card/i, 'renamecard.png'],
      [/emote.*alt/i, 'emote2.png'],
      [/emote/i, 'emote1.png'],
      [/^epic\b/i, 'epic.png'],
      [/^special\b/i, 'special.png'],
      [/^elite\b/i, 'elite.png'],
      [/^normal\b/i, 'normal.png'],
      [/^painted\b/i, 'painted.png'],
      [/diamond|dias\b/i, 'dias.png'],
    ],
  },
  'robux-plus': { folder: 'roblox', rules: [[/robux/i, 'robux.webp']] },
  valorant: { folder: 'valorant', rules: [[/\bvp\b|valorant points/i, 'vp.webp']] },
  'wuthering-waves': {
    folder: 'wuwa',
    rules: [
      [/lunite\s*sub|subscription/i, 'lunitesub.webp'],
      [/lunite/i, 'lunite.webp'],
    ],
  },
  'honor-of-kings': {
    folder: 'hok',
    rules: [
      [/weekly card\s*plus|weekly card\s*\+/i, 'weeklycardplus.png'],
      [/weekly card/i, 'weeklycard.png'],
      [/token/i, 'tokens.webp'],
    ],
  },
  'league-of-legends': { folder: 'lol', rules: [[/\bcore\b/i, 'core.webp']] }, // RP gift cards: no icon yet
  'wild-rift': { folder: 'wildrift', rules: [[/\bcore\b/i, 'core.webp']] },
  'cod-mobile': { folder: 'codm', rules: [[/\bcp\b/i, 'cp.png']] },
};

export function itemIcon(gameSlug: string, itemName: string): string | null {
  const game = GAMES[gameSlug];
  if (!game) return null;
  const hit = game.rules.find(([re]) => re.test(itemName.trim()));
  return hit ? `/items/${game.folder}/${hit[1]}` : null;
}

// Skin-tier badges (EPIC, ELITE…) are wide banners, so they get a bigger, wider slot
const WIDE = /\/mlbb\/(epic|special|elite|normal|painted)\.png$/;
export const isWideIcon = (src: string) => WIDE.test(src);
