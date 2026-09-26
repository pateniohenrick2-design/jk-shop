import './globals.css';

export const metadata = { title: 'JK SHOP', description: 'Fast & secure game top-up' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
