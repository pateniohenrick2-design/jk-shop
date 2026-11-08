'use client';

import { useEffect, useState } from 'react';

// Uploaded logo (R2) → built-in logo file (/public/payments/logos/<name>.png) → initials badge
export default function PaymentLogo({
  name, logoUrl, previewUrl, className = 'pay-logo',
}: { name: string; logoUrl?: string | null; previewUrl?: string | null; className?: string }) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const src = previewUrl || (logoUrl ? `/api/image-proxy?key=${encodeURIComponent(logoUrl)}` : `/payments/logos/${slug}.png`);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (failed) {
    const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
    return <span className={`${className} pay-logo-fallback`} aria-hidden>{initials}</span>;
  }
  return <img className={className} src={src} alt="" onError={() => setFailed(true)} />;
}
