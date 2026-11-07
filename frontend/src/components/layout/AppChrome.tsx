'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

// Admin pages get the sidebar + content offset. The public transparency
// route (/public) renders full-bleed with no admin chrome.
export function AppChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // Bare routes render full-bleed with no admin chrome (public portal, printable report).
  const bare = path?.startsWith('/public') || path?.startsWith('/report');
  if (bare) return <div className="cc-fade-in">{children}</div>;
  return (
    <>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-w)', minHeight: '100vh' }}>
        <main className="p-6 cc-fade-in">{children}</main>
      </div>
    </>
  );
}
