import './globals.css';

export const metadata = { title: 'JK SHOP', description: 'Affordable game top-up, processed by a real seller' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
