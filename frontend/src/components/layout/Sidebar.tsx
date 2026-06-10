'use client';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Table2, Terminal, Shield, AlertTriangle,
  BarChart3, Users, Store, ScrollText, Settings
} from 'lucide-react';

interface NavItem {
  id:    string;
  label: string;
  href:  string;
  icon:  React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  soon?: boolean;
}

const nav: NavItem[] = [
  { id: 'overview',  label: 'Overview',               href: '/overview',  icon: LayoutDashboard },
  { id: 'ledger',    label: 'Public Ledger',           href: '/ledger',    icon: Table2 },
  { id: 'query',     label: 'Query Terminal',          href: '/query',     icon: Terminal },
  { id: 'verify',    label: 'Blockchain Verification', href: '/verify',    icon: Shield },
  { id: 'anomalies', label: 'Anomaly Center',          href: '/anomalies', icon: AlertTriangle },
];
const navSoon: NavItem[] = [
  { id: 'contracts', label: 'Contracts',          href: '#', icon: ScrollText, soon: true },
  { id: 'budget',    label: 'Budget Analytics',   href: '#', icon: BarChart3,  soon: true },
  { id: 'vendors',   label: 'Vendor Intelligence',href: '#', icon: Store,      soon: true },
  { id: 'dept',      label: 'Department Analysis',href: '#', icon: Users,      soon: true },
  { id: 'admin',     label: 'Administration',     href: '#', icon: Settings,   soon: true },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed left-0 top-0 bottom-0 flex flex-col z-20"
      style={{ width: 'var(--sidebar-w)', background: 'var(--cc-card)', borderRight: '1px solid var(--cc-line)' }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-[56px] border-b flex-shrink-0" style={{ borderColor: 'var(--cc-line)' }}>
        <Image src="/brand/civic-chain-logo.svg" alt="Civic-Chain" width={26} height={26} className="flex-shrink-0" />
        <div>
          <p className="font-display text-[15px] leading-none" style={{ color: 'var(--cc-ink)' }}>Civic-Chain</p>
          <p className="text-[9px] font-semibold tracking-[0.1em] uppercase mt-0.5" style={{ color: 'var(--cc-muted)' }}>Admin Console</p>
        </div>
      </div>

      {/* Context badge */}
      <div className="mx-3 mt-3 px-3 py-2 rounded-md text-[11px]"
        style={{ background: 'var(--cc-tone-dusty)', color: 'var(--cc-tone-dusty-fg)' }}>
        <p className="font-semibold">Town of Any Town, Maine</p>
        <p className="opacity-70 mt-0.5">Municipal Treasury Account</p>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        <p className="type-label px-2 mb-2 mt-1">Analytics</p>
        {nav.map(item => {
          const active = path.startsWith(item.href);
          return (
            <Link key={item.id} href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2 py-2 rounded-xs text-sm transition-all duration-[120ms] group',
                active
                  ? 'font-semibold'
                  : 'hover:text-ink'
              )}
              style={active
                ? { background: 'var(--cc-blue-100)', color: 'var(--cc-ink)' }
                : { color: 'var(--cc-ink-soft)' }
              }>
              <item.icon size={15} className="flex-shrink-0"
                style={{ color: active ? 'var(--cc-blue-600)' : undefined }} />
              {item.label}
            </Link>
          );
        })}

        <p className="type-label px-2 mt-4 mb-2">Coming Soon</p>
        {navSoon.map(item => (
          <div key={item.id}
            className="flex items-center justify-between px-2 py-2 rounded-xs text-sm cursor-default select-none opacity-50"
            style={{ color: 'var(--cc-muted)' }}>
            <div className="flex items-center gap-2.5">
              <item.icon size={15} className="flex-shrink-0" />
              {item.label}
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-xs"
              style={{ background: 'var(--cc-tone-dusty)', color: 'var(--cc-tone-dusty-fg)' }}>
              SOON
            </span>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--cc-line)' }}>
        <p className="text-[11px]" style={{ color: 'var(--cc-muted)' }}>MTA-2026-HPW-001</p>
        <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--cc-muted)', opacity: 0.6 }}>Ledger Rail · FY2026</p>
      </div>
    </aside>
  );
}
