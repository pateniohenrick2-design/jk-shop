// Account field values that are uploaded screenshots are stored as full image URLs.
// R2's public .r2.dev links are blocked by some ISPs, so they're shown through our /api/image-proxy.
export function screenshotHref(value: string): string | null {
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const u = new URL(value);
    if (u.hostname.endsWith('.r2.dev')) return `/api/image-proxy?key=${encodeURIComponent(u.pathname.replace(/^\//, ''))}`;
    return value;
  } catch {
    return null;
  }
}
