'use client';
import React from 'react';
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
  icon:  React.ComponentType<{ size?: number; className?: string }>;
  soon?: boolean;
}

const nav: NavItem[] = [
  { id: 'overview',  label: 'Executive Overview',    href: '/overview',  icon: LayoutDashboard },
  { id: 'ledger',    label: 'Ledger Explorer',        href: '/ledger',    icon: Table2 },
  { id: 'query',     label: 'Query Terminal',         href: '/query',     icon: Terminal },
  { id: 'verify',    label: 'Blockchain Verification',href: '/verify',    icon: Shield },
  { id: 'anomalies', label: 'Anomaly Center',         href: '/anomalies', icon: AlertTriangle },
];
const navSoon: NavItem[] = [
  { id: 'budget',   label: 'Budget Analytics',    href: '#', icon: BarChart3, soon: true },
  { id: 'dept',     label: 'Department Analysis', href: '#', icon: Users,     soon: true },
  { id: 'vendor',   label: 'Vendor Intelligence', href: '#', icon: Store,     soon: true },
  { id: 'audit',    label: 'Audit Trail',         href: '#', icon: ScrollText,soon: true },
  { id: 'admin',    label: 'Administration',      href: '#', icon: Settings,  soon: true },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed left-0 top-0 bottom-0 flex flex-col z-20"
      style={{ width: 'var(--sidebar-w)', background: 'var(--cc-paper-deep)', borderRight: '1px solid var(--cc-line-strong)' }}>

      {/* Logo / wordmark */}
      <div className="flex items-center gap-2 px-4 h-[56px] border-b border-[#C6B99E] flex-shrink-0">
        <div className="w-6 h-6 rounded-xs bg-blue-600 flex items-center justify-center flex-shrink-0">
          <div className="w-2.5 h-2.5 border-2 border-white/80 rounded-[2px]" />
        </div>
        <div>
          <p className="font-display text-[15px] text-ink leading-none">CivicChain</p>
          <p className="text-[9px] font-sans font-semibold tracking-[0.1em] uppercase text-muted mt-0.5">Trustless Ledger</p>
        </div>
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
                  ? 'bg-[#D7E1EF] text-[#1B3D74] font-semibold'
                  : 'text-ink-soft hover:bg-[#DDD3BE]/60 hover:text-ink'
              )}>
              <item.icon size={15} className={cn('flex-shrink-0', active ? 'text-blue-600' : 'text-muted group-hover:text-ink-soft')} />
              {item.label}
            </Link>
          );
        })}

        <p className="type-label px-2 mt-4 mb-2">Insights</p>
        {navSoon.map(item => (
          <div key={item.id}
            className="flex items-center justify-between px-2 py-2 rounded-xs text-sm text-muted cursor-default select-none opacity-60">
            <div className="flex items-center gap-2.5">
              <item.icon size={15} className="flex-shrink-0 text-muted" />
              {item.label}
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-[#DDD3BE] text-muted px-1.5 py-0.5 rounded-xs">
              SOON
            </span>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#C6B99E] flex-shrink-0">
        <p className="text-[11px] text-muted">Town of Millbrook, NH</p>
        <p className="text-[10px] text-muted/60 font-mono mt-0.5">FY2026 · Anchored</p>
      </div>
    </aside>
  );
}
