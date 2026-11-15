// Reviews: shared rules + shapes (safe to import from client components)

export const MAX_REVIEW_IMAGES = 3;
export const MAX_REVIEW_COMMENT = 500;

// Customers can review once the order is finished
export const REVIEWABLE_STATUSES = ['successful', 'done'] as const;
export const canReview = (status: string) => (REVIEWABLE_STATUSES as readonly string[]).includes(status);

export type PublicReview = {
  id: string;
  displayName: string;
  rating: number;
  comment: string | null;
  images: string[]; // ready to use in <img src>
  itemName: string;
  gameName: string;
  gameSlug: string;
  adminReply: string | null;
  createdAt: string;
};

export type ReviewSummary = { average: number; count: number; counts: Record<1 | 2 | 3 | 4 | 5, number> };

export const splitImages = (v: string | null | undefined) => (v ?? '').split('\n').map((s) => s.trim()).filter(Boolean);

// "Henrick Patenio" → "Henrick P."; emails → "henr***"
export function publicName(fullName: string | null | undefined, email: string | null | undefined): string {
  const n = (fullName ?? '').trim().replace(/\s+/g, ' ');
  if (n) {
    const parts = n.split(' ');
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
  }
  const local = (email ?? '').split('@')[0];
  return local ? `${local.slice(0, 4)}***` : 'Customer';
}
