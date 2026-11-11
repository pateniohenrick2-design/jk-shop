// Dates picked in the admin are Philippine calendar days. "Sold out on 2026-11-20" means
// from 00:00 Philippine time (UTC+8, no daylight saving) on that day.

// "2026-11-20" → the instant it becomes Nov 20 in Manila. Invalid/empty → null.
export function manilaStartOfDay(date: string | null | undefined): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00+08:00`);
  return isNaN(d.getTime()) ? null : d;
}

// Date → "2026-11-20" as a Manila calendar day (for <input type="date">)
export function toManilaDateString(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // en-CA = YYYY-MM-DD
}

export function isSoldOut(soldOutAt: Date | string | null | undefined, now: number = Date.now()): boolean {
  if (!soldOutAt) return false;
  const t = new Date(soldOutAt).getTime();
  return !isNaN(t) && now >= t;
}
