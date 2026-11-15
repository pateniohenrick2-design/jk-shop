// An order can have several proof-of-payment images. They're kept in the existing
// Order.proofOfPaymentUrl column, one URL per line (an old single URL is just a list of one),
// so no database change is needed.

export const MAX_PROOFS = 5;

export function splitProofs(value: string | null | undefined): string[] {
  return (value ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
}

export function joinProofs(urls: string[]): string | null {
  const list = urls.map((u) => u.trim()).filter(Boolean).slice(0, MAX_PROOFS);
  return list.length ? list.join('\n') : null;
}
