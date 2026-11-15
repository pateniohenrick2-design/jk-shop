// Picks an icon from /public/items/<game>/ based on the item's name. Returns null when none fits.
const MLBB_RULES: [RegExp, string][] = [
  [/weekly diamond pass|^wdp\b/i, 'wdp'],
  [/via recharge/i, 'dias'],
  [/premium starlight/i, 'psl'],
  [/starlight/i, 'nsl'],
  [/flag change/i, 'flag-change'],
  [/squad rename/i, 'squadrename'],
  [/rename card/i, 'renamecard'],
  [/emote.*alt/i, 'emote2'],
  [/emote/i, 'emote1'],
  [/^epic\b/i, 'epic'],
  [/^special\b/i, 'special'],
  [/^elite\b/i, 'elite'],
  [/^normal\b/i, 'normal'],
  [/^painted\b/i, 'painted'],
  [/diamond|dias\b/i, 'dias'],
];

const RULES: Record<string, [RegExp, string][]> = { mlbb: MLBB_RULES };

export function itemIcon(gameSlug: string, itemName: string): string | null {
  const rules = RULES[gameSlug];
  if (!rules) return null;
  const hit = rules.find(([re]) => re.test(itemName.trim()));
  return hit ? `/items/${gameSlug}/${hit[1]}.png` : null;
}

// Skin-tier badges (EPIC, ELITE…) are wide banners, so they get a bigger, wider slot
const WIDE = /\/(epic|special|elite|normal|painted)\.png$/;
export const isWideIcon = (src: string) => WIDE.test(src);
