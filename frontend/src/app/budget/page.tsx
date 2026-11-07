'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, RefreshCw, Printer, X, Globe, FileText } from 'lucide-react';
import { StatTile, Badge, Button } from '@/components/cc';
import { getBudgetAnalytics, getTransactions } from '@/lib/api';
import { fmtCompact, downloadCsv } from '@/lib/utils';
import {
  YearEndProjection, TopMovers,
  SpendCharts, CategoryDrill, DepartmentBudgets,
  RevenueVsExpenditure, OpenCommitments, AmendmentsLog, status,
} from './sections';
import type { BudgetAnalyticsResponse, Fund, Transaction } from '@/types';

const FUNDS: (Fund | 'All Funds')[] = ['All Funds', 'General Fund', 'Special Revenue', 'Capital Projects'];

export default function BudgetPage() {
  const [data, setData]         = useState<BudgetAnalyticsResponse | null>(null);
  const [txns, setTxns]         = useState<Transaction[]>([]);
  const [year, setYear]         = useState('FY2026');
  const [fund, setFund]         = useState<Fund | 'All Funds'>('All Funds');
  const [category, setCategory] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => { getBudgetAnalytics(year).then(d => { setData(d); setCategory(null); }); }, [year]);
  useEffect(() => { getTransactions().then(r => setTxns(r.rows)); }, []);

  const lines = useMemo(
    () => !data ? [] : fund === 'All Funds' ? data.lines : data.lines.filter(l => l.fund === fund),
    [data, fund],
  );

  // Vendors inside the drilled category, scoped to the active fund.
  const catVendors = useMemo(() => {
    if (!category || !data) return [];
    const inFund = new Set(lines.map(l => l.name));
    const m = new Map<string, { vendor: string; txns: number; total: number }>();
    for (const t of txns) {
      if (t.category !== category) continue;
      if (fund !== 'All Funds' && !inFund.has(t.department)) continue;
      const c = m.get(t.vendor) ?? { vendor: t.vendor, txns: 0, total: 0 };
      c.txns += 1; c.total += t.amount; m.set(t.vendor, c);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [category, txns, fund, lines, data]);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="type-label animate-pulse">Loading budget data…</div>
    </div>
  );

  // KPIs from the filtered lines.
  const approved   = lines.reduce((a, l) => a + l.budget, 0);
  const actual     = lines.reduce((a, l) => a + l.spent, 0);
  const encumbered = lines.reduce((a, l) => a + l.encumbered, 0);
  const remaining  = approved - actual - encumbered;
  const utilized   = approved ? Math.round((actual / approved) * 100) : 0;

  // Year-over-year (vs prior fiscal year, same YTD point).
  const priorActual = lines.reduce((a, l) => a + (data.prior[l.name] ?? 0), 0);
  const yoyPct      = priorActual ? Math.round(((actual - priorActual) / priorActual) * 100) : 0;
  const movers = lines
    .map(l => { const prev = data.prior[l.name] ?? 0; return { name: l.name, cur: l.spent, prev, change: prev ? (l.spent - prev) / prev : 0 }; })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  // Burn-rate projection + pacing.
  const fyElapsed = data.period.fyElapsedPct;
  const health = lines.map(l => {
    const projected    = fyElapsed > 0 ? l.spent / fyElapsed : l.spent;
    const projectedPct = projected / l.budget;
    const pace: 'under' | 'on' | 'over' = projectedPct > 1.05 ? 'over' : projectedPct >= 0.95 ? 'on' : 'under';
    return { ...l, projected, projectedPct, pace };
  });
  const projTotal = health.reduce((a, h) => a + h.projected, 0);

  // Fund-scoped slices for the revenue, encumbrance, and amendment sections.
  const fundDepts = new Set(lines.map(l => l.name));
  const shownCommitments = fund === 'All Funds' ? data.commitments : data.commitments.filter(c => fundDepts.has(c.department));
  const shownFunds       = fund === 'All Funds' ? data.funds : data.funds.filter(f => f.fund === fund);
  const shownAmendments  = fund === 'All Funds' ? data.amendments : data.amendments.filter(a => a.fund === fund);

  const goDept = (name: string) => router.push(`/ledger?dept=${encodeURIComponent(name)}`);
  const exportCsv = () => {
    const header = ['Department', 'Fund', 'Approved', 'YTD Actual', 'Encumbered', 'Remaining', 'Utilized %', 'Status'];
    const rows = lines.map(l => {
      const rem = l.budget - l.spent - l.encumbered;
      return [l.name, l.fund, l.budget, l.spent, l.encumbered, rem, Math.round((l.spent / l.budget) * 100), status(l.spent, l.budget).label];
    });
    downloadCsv(`budget_${data.year}_${fund.replace(/\s+/g, '-')}.csv`, [header, ...rows]);
  };

  const eyebrow = `Municipal Finance · ${data.year}${fund !== 'All Funds' ? ' · ' + fund : ''}`;

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="type-label mb-1">{eyebrow}</p>
          <h1 className="type-h1">Budget Analytics</h1>
        </div>
        <div className="flex items-center gap-2 no-print">
          {/* Fiscal year selector */}
          <div className="flex items-center gap-1 p-1 rounded-md" style={{ background: 'var(--cc-tone-dusty)' }}>
            {data.years.map(y => (
              <button key={y} onClick={() => setYear(y)}
                className="px-2.5 py-1 rounded-xs text-[12px] font-medium transition-all duration-[120ms]"
                style={year === y
                  ? { background: 'var(--cc-card-raised)', color: 'var(--cc-ink)', boxShadow: '0 1px 2px rgba(19,31,134,0.10)' }
                  : { color: 'var(--cc-tone-dusty-fg)', opacity: 0.7 }}>
                {y}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" icon={<FileText size={13} />} href={`/report?year=${year}`}>Council Report</Button>
          <Button variant="ghost" size="sm" icon={<Globe size={13} />} href="/public">Public view</Button>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={() => getBudgetAnalytics(year).then(setData)}>Refresh</Button>
          <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={exportCsv}>Export CSV</Button>
          <Button variant="ghost" size="sm" icon={<Printer size={13} />} onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      {/* Toolbar: fund control + drill breadcrumb */}
      <div className="flex items-center gap-3 flex-wrap no-print">
        <div className="flex items-center gap-1 p-1 rounded-md w-fit" style={{ background: 'var(--cc-tone-dusty)' }}>
          {FUNDS.map(f => (
            <button key={f} onClick={() => setFund(f)}
              className="px-3 py-1.5 rounded-xs text-[12px] font-medium transition-all duration-[120ms]"
              style={fund === f
                ? { background: 'var(--cc-card-raised)', color: 'var(--cc-ink)', boxShadow: '0 1px 2px rgba(19,31,134,0.10)' }
                : { color: 'var(--cc-tone-dusty-fg)', opacity: 0.7 }}>
              {f}
            </button>
          ))}
        </div>
        {category && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className="type-label">Drill:</span>
            <Badge tone="info" dot={false}>{fund} › {category}</Badge>
            <button onClick={() => setCategory(null)} className="inline-flex items-center gap-1 text-muted hover:text-ink transition-colors">
              <X size={13} /> Clear
            </button>
          </div>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Approved Budget" value={fmtCompact(approved)} sub="FY appropriation" accent="var(--chart-1)" />
        <StatTile label="YTD Actual Spend" value={fmtCompact(actual)} sub={`${utilized}% utilized`} delta={`${yoyPct >= 0 ? '+' : ''}${yoyPct}% YoY`} deltaTone="neutral" accent="var(--chart-2)" />
        <StatTile label="Encumbrances" value={fmtCompact(encumbered)} sub="Open commitments" accent="var(--chart-3)" />
        <StatTile label="Remaining Balance" value={fmtCompact(remaining)} sub={`${100 - utilized}% of budget`} accent="var(--chart-4)" />
      </div>

      <YearEndProjection projections={health} projTotal={projTotal} approved={approved} asOf={data.period.asOf} fyElapsed={fyElapsed} onRowClick={goDept} />

      <TopMovers movers={movers} asOf={data.period.asOf} />

      <SpendCharts trend={data.trend} byCategory={data.byCategory}
        onCategorySelect={(name) => setCategory(c => (c === name ? null : name ?? null))} />

      {category && <CategoryDrill fund={fund} category={category} vendors={catVendors} />}

      <DepartmentBudgets lines={lines} onRowClick={goDept} />

      {/* Revenue side + encumbrance detail + amendment history */}
      <RevenueVsExpenditure funds={shownFunds} />
      <OpenCommitments commitments={shownCommitments} />
      <AmendmentsLog amendments={shownAmendments} />
    </div>
  );
}
