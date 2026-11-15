// When a category (e.g. "Pre-Order Event") is open to customers.
// Set in Admin → Pricelists: an on/off switch plus optional open and close date-times.

export type Availability = {
  isActive: boolean;
  availableFrom: string | Date | null;
  availableUntil: string | Date | null;
};

export type AvailabilityState = 'open' | 'disabled' | 'upcoming' | 'closed';

const ms = (d: string | Date | null) => (d ? new Date(d).getTime() : null);

export function availabilityState(a: Availability, now: number = Date.now()): AvailabilityState {
  if (!a.isActive) return 'disabled';
  const from = ms(a.availableFrom);
  const until = ms(a.availableUntil);
  if (from !== null && now < from) return 'upcoming';
  if (until !== null && now >= until) return 'closed';
  return 'open';
}

// Every category has the on/off switch + optional open/close dates (Admin → Pricelists → Manage)
export const isPreOrderCategory = (categoryName: string) => /pre[\s-]?order/i.test(categoryName);

export const isCategoryOpen = (c: Availability & { name?: string }, now?: number) => availabilityState(c, now) === 'open';
