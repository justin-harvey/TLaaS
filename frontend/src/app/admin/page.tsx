'use client';
import React, { useEffect, useState } from 'react';
import { getAdmin } from '@/lib/api';
import { GovernanceTab, UsersTab, ConnectionsTab, SettingsTab } from './tabs';
import type { AdminConsole } from '@/types';

const TABS = ['Governance', 'Users & Roles', 'Data Connections', 'Settings & Ruleset'] as const;
type Tab = typeof TABS[number];

export default function AdminPage() {
  const [data, setData] = useState<AdminConsole | null>(null);
  const [tab, setTab]   = useState<Tab>('Governance');

  useEffect(() => { getAdmin().then(setData); }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="type-label animate-pulse">Loading administration…</div>
    </div>
  );

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* Header */}
      <div>
        <p className="type-label mb-1">Town of Any Town · Tenant administration</p>
        <h1 className="type-h1">Administration</h1>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-md w-fit flex-wrap" style={{ background: 'var(--cc-tone-dusty)' }}>
        {TABS.map(name => (
          <button key={name} onClick={() => setTab(name)}
            className="px-3 py-1.5 rounded-xs text-[12px] font-medium transition-all duration-[120ms]"
            style={tab === name
              ? { background: 'var(--cc-card-raised)', color: 'var(--cc-ink)', boxShadow: '0 1px 2px rgba(19,31,134,0.10)' }
              : { color: 'var(--cc-tone-dusty-fg)', opacity: 0.7 }}>
            {name}
          </button>
        ))}
      </div>

      {tab === 'Governance'         && <GovernanceTab data={data} />}
      {tab === 'Users & Roles'      && <UsersTab data={data} />}
      {tab === 'Data Connections'   && <ConnectionsTab data={data} />}
      {tab === 'Settings & Ruleset' && <SettingsTab data={data} />}
    </div>
  );
}
