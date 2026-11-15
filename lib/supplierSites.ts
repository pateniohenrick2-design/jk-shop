// Top-up sites used by the PROCESS button (same list as scripts/google-apps-script/ProcessButton.gs).
// The Tampermonkey script (jk-autofill.user.js) reads the "#jk=..." part of the link and fills the site in.
export const SUPPLIER_SITES = [
  { name: 'egamesscredits', url: 'https://egamesscredits.com/games/ml-bang-bang' },
  { name: 'Ethanoxe', url: 'https://ethanoxe-games.com/games/mobile-legends-ph-v1a' },
];

export const RECEIPT_EMAIL = ''; // fills the site's receipt email box; blank = skip (same as the sheet)

// Only MLBB Diamonds + Pre-Order Event orders can be topped up on these sites
export function canProcessOnSupplier(o: { gameName: string; categoryName: string; itemName: string | null }) {
  return /mobile\s*legend|mlbb/i.test(o.gameName) && /^(diamonds|pre-?order event)$/i.test(o.categoryName.trim()) && !!o.itemName;
}

// Same payload the sheet's PROCESS button puts in the link: { u, z, item, email, row }
export function supplierLink(siteUrl: string, d: { userId: string; serverId: string; item: string; orderCode: string }) {
  const data = { u: d.userId.trim(), z: d.serverId.replace(/\D/g, ''), item: d.item.trim(), email: RECEIPT_EMAIL, row: 0, order: d.orderCode };
  return `${siteUrl}#jk=${encodeURIComponent(JSON.stringify(data))}`;
}
