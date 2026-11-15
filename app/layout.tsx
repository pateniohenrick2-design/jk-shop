import { Suspense } from 'react';
import './globals.css';
import NavProgress from '@/components/NavProgress';
import StoreStatusBanner from '@/components/StoreStatusBanner';

export const metadata = { title: 'JK SHOP', description: 'Affordable game top-up, processed by a real seller' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* useSearchParams needs a Suspense boundary so static pages still pre-render */}
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <StoreStatusBanner />
        {children}
      </body>
    </html>
  );
}
