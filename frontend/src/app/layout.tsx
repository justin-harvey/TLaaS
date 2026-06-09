import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/Sidebar';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'CivicChain · Trustless Ledger Analytics',
  description: 'Every dollar on the record. Blockchain-anchored municipal procurement analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="bg-paper text-ink antialiased">
        <Sidebar />
        <div style={{ marginLeft: 'var(--sidebar-w)', minHeight: '100vh' }}>
          <main className="p-6 cc-fade-in">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
