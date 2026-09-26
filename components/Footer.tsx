export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <strong style={{ fontSize: 18 }}>JK SHOP</strong>
          <p>Your trusted game top-up partner</p>
        </div>
        <div className="footer-cols">
          <div>
            <h4>Shop</h4>
            <a href="/">All Games</a>
            <a href="/">Top-Up</a>
            <a href="/">Gift Cards</a>
          </div>
          <div>
            <h4>Support</h4>
            <a href="/">Help Center</a>
            <a href="/track-order">Track Order</a>
            <a href="/">Contact</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">© 2026 JK SHOP. All rights reserved.</div>
    </footer>
  );
}
