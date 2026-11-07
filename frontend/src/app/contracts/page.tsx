'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight, AlertTriangle } from 'lucide-react';
import { Card, StatTile, Badge, Button, Input } from '@/components/cc';
import { getContracts } from '@/lib/api';
import { topFlag, FLAG_LABEL, FLAG_TONE } from '@/lib/contracts';
import { fmtCompact, fmtUSD, fmtDate } from '@/lib/utils';
import type { ContractDetail } from '@/types';

// Compact one-line descriptor for a contract's top flag.
function flagBrief(c: ContractDetail): string {
  const tf = topFlag(c.flags);
  switch (tf) {
    case 'over_ceiling':
    case 'near_ceiling': return `${Math.round(c.utilizedPct * 100)}% of not-to-exceed`;
    case 'expiring':     return `Ends in ${c.daysLeft} days`;
    case 'po_breach':    return 'A payment exceeded the PO ceiling';
    case 'stalled':      return 'No recent activity';
    default:             return '';
  }
}

// Inline utilization bar for a table cell.
function UtilBar({ pct }: { pct: number }) {
  const color = pct > 1 ? '#A8483A' : pct >= 0.85 ? '#B8862B' : '#5F7E5A';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'var(--cc-line)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 1) * 100}%`, background: color }} />
      </div>
      <span className="font-mono tabular-nums text-[12px]" style={{ color: pct > 1 ? '#A8483A' : 'var(--cc-ink-soft)' }}>{Math.round(pct * 100)}%</span>
    </div>
  );
}

export default function ContractsPage() {
  const [data, setData]     = useState<ContractDetail[] | null>(null);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => { getContracts().then(setData); }, []);

  const rows = useMemo(() => !data ? [] : data.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.vendor.toLowerCase().includes(search.toLowerCase())
  ), [data, search]);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="type-label animate-pulse">Loading contracts…</div>
    </div>
  );

  const flagged    = data.filter(c => c.flags.length > 0);   // severity-sorted by the API
  const activeCnt  = data.filter(c => c.status === 'Active' || c.status === 'Expiring').length;
  const totalValue = data.reduce((a, c) => a + c.value, 0);
  const expiring   = data.filter(c => c.flags.includes('expiring')).length;
  const ceiling    = data.filter(c => c.flags.includes('over_ceiling') || c.flags.includes('near_ceiling')).length;

  const open = (id: string) => router.push(`/contracts/${id}`);

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* Header */}
      <div>
        <p className="type-label mb-1">Procurement · FY2026</p>
        <h1 className="type-h1">Contracts</h1>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Active Contracts" value={activeCnt} sub="Currently in force" accent="var(--chart-1)" />
        <StatTile label="Total Contracted Value" value={fmtCompact(totalValue)} sub="Sum of not-to-exceed" accent="var(--chart-2)" />
        <StatTile label="Expiring Soon" value={expiring} sub="Within 60 days" accent="var(--chart-5)" />
        <StatTile label="Over / Near Ceiling" value={ceiling} sub="Need review" accent="var(--cc-spike)" />
      </div>

      {/* Needs attention (balanced: ceiling + expiry + PO breach + stalled) */}
      <Card eyebrow="Balanced priority" title="Needs Attention"
        actions={<Badge tone={flagged.length ? 'spike' : 'anchored'} dot>{flagged.length} flagged</Badge>}>
        {flagged.length === 0 ? (
          <p className="text-[13px] text-[#5F7E5A]">All contracts are within ceiling and term.</p>
        ) : (
          <div className="space-y-2">
            {flagged.map(c => {
              const tf = topFlag(c.flags)!;
              return (
                <button key={c.id} onClick={() => open(c.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xs border text-left transition-colors hover:bg-[#DBE3EE]/40"
                  style={{ borderColor: 'var(--cc-line)' }}>
                  <AlertTriangle size={15} className="flex-shrink-0" style={{ color: FLAG_TONE[tf] === 'spike' ? '#A8483A' : FLAG_TONE[tf] === 'pending' ? '#B8862B' : '#5C6382' }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink truncate">{c.title}</span>
                      <span className="text-[11px] font-mono text-muted">{c.id}</span>
                    </div>
                    <p className="text-[12px] text-muted truncate">{c.vendor} · {c.department}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[12px] text-muted hidden sm:inline">{flagBrief(c)}</span>
                    <Badge tone={FLAG_TONE[tf]} dot={false}>{FLAG_LABEL[tf]}</Badge>
                    <ChevronRight size={14} className="text-muted" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Full register */}
      <Card eyebrow="Contract register" title={`${rows.length} contract${rows.length === 1 ? '' : 's'}`} padded={false}
        actions={
          <Input icon={<Search size={14} />} placeholder="Search title or vendor…" size="sm"
            value={search} onChange={e => setSearch(e.target.value)} wrapStyle={{ width: 240 }} />
        }>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <th className="type-label py-2.5 px-4 text-left">Contract</th>
                <th className="type-label py-2.5 px-4 text-left">Vendor</th>
                <th className="type-label py-2.5 px-4 text-left">Department</th>
                <th className="type-label py-2.5 px-4 text-left">Type</th>
                <th className="type-label py-2.5 px-4 text-right">Not-to-Exceed</th>
                <th className="type-label py-2.5 px-4 text-left">Spent</th>
                <th className="type-label py-2.5 px-4 text-left">Term</th>
                <th className="type-label py-2.5 px-4 text-left">Flag</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(c => {
                const tf = topFlag(c.flags);
                const termTone = c.daysLeft < 0 ? '#A8483A' : c.daysLeft <= 60 ? '#B8862B' : 'var(--cc-muted)';
                return (
                  <tr key={c.id} onClick={() => open(c.id)}
                    className="border-b cursor-pointer transition-colors hover:bg-[#DBE3EE]/40"
                    style={{ borderColor: 'var(--cc-line)' }}>
                    <td className="py-2.5 px-4">
                      <div className="text-ink font-medium">{c.title}</div>
                      <div className="text-[11px] font-mono text-muted">{c.id}</div>
                    </td>
                    <td className="py-2.5 px-4 text-ink-soft">{c.vendor}</td>
                    <td className="py-2.5 px-4 text-muted">{c.department}</td>
                    <td className="py-2.5 px-4 text-muted">{c.type}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(c.value)}</td>
                    <td className="py-2.5 px-4"><UtilBar pct={c.utilizedPct} /></td>
                    <td className="py-2.5 px-4">
                      <div className="text-ink-soft">{fmtDate(c.endDate)}</div>
                      <div className="text-[11px]" style={{ color: termTone }}>{c.daysLeft < 0 ? 'Expired' : `${c.daysLeft} days left`}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      {tf ? <Badge tone={FLAG_TONE[tf]} dot={false}>{FLAG_LABEL[tf]}</Badge>
                          : <span className="text-[12px] text-[#5F7E5A]">On track</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
