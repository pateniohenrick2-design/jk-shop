'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Top navigation: the link for the page you're on is highlighted (white + green underline);
// the others are muted. Game pages count as part of HOME (that's where you pick a game).
const LINKS = [
  { href: '/', label: 'HOME', extra: 'nav-home', isActive: (p: string) => p === '/' || p.startsWith('/game/') },
  { href: '/my-orders', label: 'MY ORDERS', extra: '', isActive: (p: string) => p.startsWith('/my-orders') },
];

export default function NavLinks() {
  const pathname = usePathname() || '/';
  return (
    <>
      {LINKS.map((l) => {
        const active = l.isActive(pathname);
        return (
          <Link key={l.href} href={l.href} className={`nav-link ${l.extra}${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
