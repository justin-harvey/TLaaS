import type { Metadata } from 'next';
import { AppChrome } from '@/components/layout/AppChrome';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Civic-Chain · Municipal Ledger Analytics',
  description: 'A procurement platform where money moves fast, and everyone can watch. Blockchain-anchored municipal transparency.',
  icons: { icon: '/brand/civic-chain-logo.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="bg-paper text-ink antialiased">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
