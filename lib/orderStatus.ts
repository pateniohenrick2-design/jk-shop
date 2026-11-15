// Order statuses in one place (safe to import from client components).
// Must match `enum OrderStatus` in prisma/schema.prisma.

export const ORDER_STATUSES = [
  'pending', 'in_progress', 'reserved', 'friends', 'done', 'successful', 'refund', 'failed',
] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const isOrderStatus = (s: unknown): s is OrderStatusValue =>
  typeof s === 'string' && (ORDER_STATUSES as readonly string[]).includes(s);

export const GIFTING_CATEGORY = 'Event Skin Gifting';
export const isGiftingCategory = (categoryName: string) => categoryName === GIFTING_CATEGORY;

// Choices in the admin status dropdown. Event Skin Gifting uses the same words as its sheet tabs
// (PENDING / RESERVED / FRIENDS / DELIVERED / FAILED); "Delivered" is stored as successful.
export const GENERAL_OPTIONS: OrderStatusValue[] = ['pending', 'in_progress', 'successful', 'refund', 'failed'];
export const GIFTING_OPTIONS: OrderStatusValue[] = ['pending', 'reserved', 'friends', 'successful', 'failed'];

const LABELS: Record<OrderStatusValue, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  reserved: 'Reserved',
  friends: 'Friends',
  done: 'Done',
  successful: 'Successful',
  refund: 'Refund',
  failed: 'Failed',
};

export function statusLabel(status: string, gifting = false): string {
  if (gifting && status === 'successful') return 'Delivered';
  return LABELS[status as OrderStatusValue] ?? status;
}

// Wording customers see on My Orders / order lookup
const CUSTOMER_LABELS: Record<OrderStatusValue, string> = {
  pending: 'Pending',
  in_progress: 'Processing',
  reserved: 'Reserved',
  friends: 'Friend request sent',
  done: 'Completed',
  successful: 'Completed',
  refund: 'Refunded',
  failed: 'Failed',
};
export function customerStatusLabel(status: string, gifting = false): string {
  if (gifting && (status === 'successful' || status === 'done')) return 'Delivered';
  return CUSTOMER_LABELS[status as OrderStatusValue] ?? status;
}

// CSS class for the status badge (see .badge-* in globals.css)
export const statusBadgeClass = (status: string) => `badge badge-${status === 'in_progress' ? 'progress' : status}`;
