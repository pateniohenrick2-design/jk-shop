// Items whose price follows a Diamonds item in the same game, matched by name:
//   "Normal Starlight via Recharge (301 Diamonds)"  →  same price as "301 Diamonds"
//   "Premium Starlight via Recharge (749 Diamonds)" →  same price as "749 Diamonds"
// (No database code here, so the admin page can use it in the browser.)
const LINK_RE = /via\s+recharge\s*\(\s*([\d,]+)\s*diamonds?\s*\)/i;

export function linkedDiamondName(itemName: string): string | null {
  const m = itemName.match(LINK_RE);
  return m ? `${m[1].replace(/,/g, '')} Diamonds` : null;
}
