import Link from 'next/link';
import HeaderAuth from './HeaderAuth';

export default function Header() {
  return (
    <div className="topbar">
      <Link href="/" className="brand">
        <span className="brand-logo">JK</span> JK SHOP
      </Link>
      <div className="nav">
        <Link href="/" className="nav-home">HOME</Link>
        <Link href="/my-orders" className="muted">MY ORDERS</Link>
        <HeaderAuth />
      </div>
    </div>
  );
}
