import Link from 'next/link';

export default function Header() {
  return (
    <div className="topbar">
      <Link href="/" className="brand">
        <span className="brand-logo">JK</span> JK SHOP
      </Link>
      <div className="nav">
        <Link href="/">HOME</Link>
        <Link href="/track-order" className="muted">TRACK ORDER</Link>
      </div>
    </div>
  );
}
