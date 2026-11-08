import { redirect } from 'next/navigation';

// Old address (used in earlier receipts and bookmarks) — the page is now "My Orders".
export default function TrackOrderRedirect() {
  redirect('/my-orders');
}
