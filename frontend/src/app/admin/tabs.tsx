'use client';
import React, { useState } from 'react';
import { RefreshCw, Lock, CheckCircle2, ShieldCheck, UserPlus, AlertTriangle, Plug } from 'lucide-react';
import { Card, Badge, Button, HashChip } from '@/components/cc';
import { fmtDate } from '@/lib/utils';
import type { AdminConsole, AdminRole, UserStatus, ConnectionStatus, DataConnection } from '@/types';

const ROLE_TONE: Record<AdminRole, 'info' | 'anchored' | 'neutral'> = {
  Administrator: 'info', Finance: 'anchored', Viewer: 'neutral',
};
const USTATUS_TONE: Record<UserStatus, 'anchored' | 'pending' | 'neutral'> = {
  Active: 'anchored', Invited: 'pending', Disabled: 'neutral',
};
const CONN_TONE: Record<ConnectionStatus, 'anchored' | 'info' | 'spike' | 'neutral'> = {
  Connected: 'anchored', Syncing: 'info', Error: 'spike', Disconnected: 'neutral',
};

const monthLabel = (mk: string) => {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

/* =========================================================
   Governance & integrity (hero tab)
   ========================================================= */
export function GovernanceTab({ data }: { data: AdminConsole }) {
  const [periods, setPeriods]       = useState(data.closedPeriods);
  const [openMonth, setOpenMonth]   = useState(data.openMonth);
  const [closeState, setCloseState] = useState<'idle' | 'confirming' | 'anchoring' | 'done'>('idle');

  const closePeriod = () => {
    setCloseState('anchoring');
    setTimeout(() => {
      const tx = Array.from({ length: 22 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
      setPeriods(p => [{ monthKey: openMonth, closedAt: '2026-04-01', closedBy: 'Dana Whitfield', records: 44, stellarTx: tx }, ...p]);
      const [y, m] = openMonth.split('-').map(Number);
      setOpenMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`);
      setCloseState('done');
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Authorized signers */}
      <Card eyebrow="Tenant admin registry" title="Authorized Signers">
        <div className="space-y-2.5">
          {data.tenant.adminWallets.map((w, i) => (
            <div key={w} className="flex items-center gap-2.5">
              <ShieldCheck size={14} className="text-[#5F7E5A] flex-shrink-0" />
              <span className="text-[13px] text-ink-soft">Admin {i + 1}</span>
              <HashChip value={w} chars={6} tone="anchored" />
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted mt-3">Only these Stellar addresses can sign close-of-period and category overrides.</p>
      </Card>

      {/* Close of period */}
      <Card eyebrow="Settlement" title={`Close of Period · ${monthLabel(openMonth)} open`}>
        <div className="space-y-3">
          <p className="text-[13px] text-muted">Anchor the {monthLabel(openMonth)} settlement fingerprint on-chain. This is irreversible.</p>
          {closeState === 'idle' && (
            <Button variant="secondary" size="sm" icon={<Lock size={13} />} onClick={() => setCloseState('confirming')}>
              Close {monthLabel(openMonth)}…
            </Button>
          )}
          {closeState === 'confirming' && (
            <div className="p-3 rounded-xs space-y-2" style={{ background: '#F0E6CF', border: '1px solid #B8862B40' }}>
              <p className="text-[13px] font-semibold text-ink">Confirm: anchor all {monthLabel(openMonth)} records on-chain?</p>
              <p className="text-[12px] text-muted">An authorized admin wallet signs the close intent. The fingerprint is written to the Soroban contract and cannot be overwritten.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={closePeriod}>Confirm and anchor</Button>
                <Button size="sm" variant="ghost" onClick={() => setCloseState('idle')}>Cancel</Button>
              </div>
            </div>
          )}
          {closeState === 'anchoring' && (
            <p className="text-[13px] text-muted animate-pulse flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin" /> Signing and anchoring…</p>
          )}
          {closeState === 'done' && (
            <div className="flex items-center gap-2 text-[13px] text-[#3A5436]"><CheckCircle2 size={14} /> Period anchored. See the anchor history below.</div>
          )}
        </div>
      </Card>

      {/* Anchor history */}
      <Card eyebrow="On-chain record" title="Anchor History" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <th className="type-label py-2.5 px-4 text-left">Month</th>
                <th className="type-label py-2.5 px-4 text-left">Closed</th>
                <th className="type-label py-2.5 px-4 text-left">Closed by</th>
                <th className="type-label py-2.5 px-4 text-right">Records</th>
                <th className="type-label py-2.5 px-4 text-left">On-chain tx</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.monthKey} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                  <td className="py-2.5 px-4 text-ink font-medium">{monthLabel(p.monthKey)}</td>
                  <td className="py-2.5 px-4 text-muted">{fmtDate(p.closedAt)}</td>
                  <td className="py-2.5 px-4 text-ink-soft">{p.closedBy}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{p.records}</td>
                  <td className="py-2.5 px-4"><HashChip value={p.stellarTx} chars={6} tone="anchored" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Override audit trail */}
      <Card eyebrow="Accountability" title={`Override Audit Trail · ${data.audit.length} entries`} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <th className="type-label py-2.5 px-4 text-left">Date</th>
                <th className="type-label py-2.5 px-4 text-left">Vendor</th>
                <th className="type-label py-2.5 px-4 text-left">Reclassification</th>
                <th className="type-label py-2.5 px-4 text-left">Admin</th>
                <th className="type-label py-2.5 px-4 text-left">Justification</th>
                <th className="type-label py-2.5 px-4 text-left">Proof</th>
              </tr>
            </thead>
            <tbody>
              {data.audit.map(a => (
                <tr key={a.id} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                  <td className="py-2.5 px-4 text-muted whitespace-nowrap">{fmtDate(a.signedAt)}</td>
                  <td className="py-2.5 px-4 text-ink font-medium">{a.vendor}</td>
                  <td className="py-2.5 px-4 text-ink-soft">{a.previousCategory} → {a.newCategory}</td>
                  <td className="py-2.5 px-4 text-muted">{a.admin}</td>
                  <td className="py-2.5 px-4 text-muted max-w-[280px]">{a.justification}</td>
                  <td className="py-2.5 px-4"><HashChip value={a.tx} chars={6} tone="anchored" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* =========================================================
   Users & Roles (RBAC)
   ========================================================= */
export function UsersTab({ data }: { data: AdminConsole }) {
  const [users, setUsers] = useState(data.users);
  const toggle = (id: string) =>
    setUsers(us => us.map(u => u.id === id ? { ...u, status: u.status === 'Disabled' ? 'Active' : 'Disabled' } : u));

  const roles: [AdminRole, string][] = [
    ['Administrator', 'Full access, including governance signing (close-of-period and category overrides).'],
    ['Finance', 'Create and edit records, reclassify categories (with a signed audit trail), and run reports.'],
    ['Viewer', 'Read-only access. For council members and external auditors.'],
  ];

  return (
    <div className="space-y-6">
      <Card eyebrow="Access model" title="Roles">
        <div className="space-y-3">
          {roles.map(([role, desc]) => (
            <div key={role} className="flex items-start gap-3">
              <Badge tone={ROLE_TONE[role]} dot={false}>{role}</Badge>
              <p className="text-[13px] text-ink-soft">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted mt-3">Least privilege by default. Access is revoked on role change or departure (per the Access Control Policy).</p>
      </Card>

      <Card eyebrow="People" title={`${users.length} users`} padded={false}
        actions={<Button size="sm" variant="secondary" icon={<UserPlus size={13} />}>Invite user</Button>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <th className="type-label py-2.5 px-4 text-left">Name</th>
                <th className="type-label py-2.5 px-4 text-left">Email</th>
                <th className="type-label py-2.5 px-4 text-left">Role</th>
                <th className="type-label py-2.5 px-4 text-left">Status</th>
                <th className="type-label py-2.5 px-4 text-left">Last login</th>
                <th className="type-label py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                  <td className="py-2.5 px-4 text-ink font-medium">{u.name}</td>
                  <td className="py-2.5 px-4 font-mono text-[12px] text-muted">{u.email}</td>
                  <td className="py-2.5 px-4"><Badge tone={ROLE_TONE[u.role]} dot={false}>{u.role}</Badge></td>
                  <td className="py-2.5 px-4"><Badge tone={USTATUS_TONE[u.status]} dot>{u.status}</Badge></td>
                  <td className="py-2.5 px-4 text-muted">{u.lastLogin ? fmtDate(u.lastLogin) : 'Never'}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button onClick={() => toggle(u.id)} className="text-[12px] text-blue-500 hover:text-blue-700 transition-colors">
                      {u.status === 'Disabled' ? 'Activate' : 'Deactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* =========================================================
   Data Connections
   ========================================================= */
export function ConnectionsTab({ data }: { data: AdminConsole }) {
  const [conns, setConns] = useState<DataConnection[]>(data.connections);
  const sync = (id: string) => {
    setConns(cs => cs.map(c => c.id === id ? { ...c, status: 'Syncing' } : c));
    setTimeout(() => setConns(cs => cs.map(c => c.id === id
      ? { ...c, status: 'Connected', lastSync: '2026-04-01 09:14', recordsToday: c.recordsToday + 2, note: undefined }
      : c)), 1100);
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">The feeds that populate the ledger. This is where you confirm data is flowing.</p>
      {conns.map(c => (
        <Card key={c.id} eyebrow={c.kind} title={c.name}
          actions={
            <Button size="sm" variant="ghost" icon={<RefreshCw size={13} className={c.status === 'Syncing' ? 'animate-spin' : ''} />}
              onClick={() => sync(c.id)} disabled={c.status === 'Syncing'}>
              {c.status === 'Syncing' ? 'Syncing…' : 'Sync now'}
            </Button>
          }>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Plug size={14} style={{ color: c.status === 'Error' ? '#A8483A' : '#5F7E5A' }} />
              <Badge tone={CONN_TONE[c.status]} dot>{c.status}</Badge>
            </div>
            <div>
              <p className="type-label">Last sync</p>
              <p className="text-[13px] text-ink-soft font-mono tabular-nums">{c.lastSync}</p>
            </div>
            <div>
              <p className="type-label">Records today</p>
              <p className="text-[13px] text-ink-soft font-mono tabular-nums">{c.recordsToday}</p>
            </div>
          </div>
          {c.note && (
            <div className="flex items-center gap-2 mt-3 text-[12px] text-[#A8483A]">
              <AlertTriangle size={13} /> {c.note}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* =========================================================
   Settings & Ruleset
   ========================================================= */
export function SettingsTab({ data }: { data: AdminConsole }) {
  const t = data.tenant;
  const profile: [string, string][] = [
    ['Organization', t.name],
    ['Plan tier', `${t.tier} (${t.population})`],
    ['Fiscal year start', t.fiscalYearStart],
    ['Funds', t.funds.join(' · ')],
    ['Data retention', `${t.retentionMonths} months (${Math.round(t.retentionMonths / 12)} years)`],
  ];

  return (
    <div className="space-y-6">
      <Card eyebrow="Tenant" title="Profile & Fiscal Settings">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {profile.map(([label, val]) => (
            <div key={label}>
              <p className="type-label mb-0.5">{label}</p>
              <p className="text-[14px] text-ink">{val}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card eyebrow="Semantic layer" title={`Category Ruleset · ${data.ruleset.length} rules`} padded={false}>
        <p className="text-[12px] text-muted px-4 pt-3">The MCC-to-category mapping that drives categorization across every page.</p>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <th className="type-label py-2.5 px-4 text-left">MCC</th>
                <th className="type-label py-2.5 px-4 text-left">Merchant category</th>
                <th className="type-label py-2.5 px-4 text-left">Assigned category</th>
              </tr>
            </thead>
            <tbody>
              {data.ruleset.map(r => (
                <tr key={r.mcc} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-ink-soft">{String(r.mcc).padStart(4, '0')}</td>
                  <td className="py-2.5 px-4 text-muted">{r.mccDesc}</td>
                  <td className="py-2.5 px-4 text-ink font-medium">{r.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
