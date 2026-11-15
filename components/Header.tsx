import Link from 'next/link';
import HeaderAuth from './HeaderAuth';
import NavLinks from './NavLinks';

export default function Header() {
  return (
    <div className="topbar">
      <Link href="/" className="brand">
        <img src="/logo/jkshop-logo.png" alt="JK SHOP" className="brand-img" />
      </Link>
      <div className="nav">
        <NavLinks />
        <HeaderAuth />
      </div>
    </div>
  );
}
