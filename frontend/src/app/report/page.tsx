'use client';
import React, { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Printer, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/cc';
import { getBudgetAnalytics, getVendors, getAnomalies } from '@/lib/api';
import { computeBudgetHealth, overallRating, RATING_COLOR, status } from '@/lib/budget-health';
import { fmtUSD, fmtCompact, fmtDate } from '@/lib/utils';
import type { BudgetAnalyticsResponse, VendorsResponse, AnomaliesResponse } from '@/types';

const statusColor: Record<'info' | 'pending' | 'spike', string> = {
  info:    'var(--cc-blue-600)',
  pending: '#B8862B',
  spike:   '#A8483A',
};

function ReportInner() {
  const params = useSearchParams();
  const year = params.get('year') ?? 'FY2026';

  const [budget, setBudget]   = useState<BudgetAnalyticsResponse | null>(null);
  const [vendors, setVendors] = useState<VendorsResponse | null>(null);
  const [anoms, setAnoms]     = useState<AnomaliesResponse | null>(null);

  useEffect(() => { getBudgetAnalytics(year).then(setBudget); }, [year]);
  useEffect(() => { getVendors().then(setVendors); getAnomalies().then(setAnoms); }, []);

  if (!budget) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cc-paper)' }}>
      <p className="type-label animate-pulse">Preparing report…</p>
    </div>
  );

  const lines = budget.lines;
  const approved  = lines.reduce((a, l) => a + l.budget, 0);
  const actual    = lines.reduce((a, l) => a + l.spent, 0);
  const committed = lines.reduce((a, l) => a + l.encumbered, 0);
  const remaining = approved - actual - committed;
  const utilized  = approved ? Math.round((actual / approved) * 100) : 0;

  const priorActual = lines.reduce((a, l) => a + (budget.prior[l.name] ?? 0), 0);
  const yoyPct      = priorActual ? Math.round(((actual - priorActual) / priorActual) * 100) : 0;
  const fyElapsed   = budget.period.fyElapsedPct;

  const deptAnomalies: Record<string, number> = {};
  (anoms?.items ?? []).forEach(a => { deptAnomalies[a.dept] = (deptAnomalies[a.dept] ?? 0) + 1; });
  const healthItems = computeBudgetHealth(lines, fyElapsed, deptAnomalies);
  const health = overallRating(healthItems);

  const projections = lines.map(l => {
    const projected = fyElapsed > 0 ? l.spent / fyElapsed : l.spent;
    return { name: l.name, projected, projectedPct: projected / l.budget, budget: l.budget };
  });
  const overBudget = projections.filter(p => p.projectedPct > 1.02).sort((a, b) => b.projectedPct - a.projectedPct);

  const funds      = budget.funds;
  const fundTot    = funds.reduce((a, f) => ({ revenue: a.revenue + f.revenue, expenditure: a.expenditure + f.expenditure, ending: a.ending + f.endingBalance }), { revenue: 0, expenditure: 0, ending: 0 });
  const topVendors = (vendors?.topVendors ?? []).slice(0, 5);
  const flagged    = anoms?.items ?? [];
  const today      = fmtDate(new Date().toISOString());
  const fyLabel    = year.replace('FY', '');

  return (
    <div className="min-h-screen" style={{ background: 'var(--cc-paper)' }}>
      {/* On-screen controls (hidden in print) */}
      <div className="no-print flex items-center justify-between px-6 h-[52px] border-b" style={{ background: 'var(--cc-card)', borderColor: 'var(--cc-line)' }}>
        <Link href="/budget" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink transition-colors">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <Button size="sm" icon={<Printer size={13} />} onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>

      <article className="max-w-[820px] mx-auto px-8 py-10 space-y-8" style={{ color: 'var(--cc-ink-soft)' }}>

        {/* Cover */}
        <header className="report-section flex items-start justify-between border-b pb-6" style={{ borderColor: 'var(--cc-line-strong)' }}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image src="/brand/civic-chain-logo.svg" alt="" width={22} height={22} />
              <span className="type-label">Town of Any Town, Maine</span>
            </div>
            <h1 className="type-display leading-tight">Council Financial Report</h1>
            <p className="text-[13px] mt-2" style={{ color: 'var(--cc-muted)' }}>
              Office of the Finance Director · Fiscal Year {fyLabel} · Period through {budget.period.asOf}
            </p>
          </div>
          <div className="text-right flex-shrink-0 ml-6">
            <p className="type-label">Prepared</p>
            <p className="text-[14px] text-ink font-medium">{today}</p>
            <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-md text-[12px] font-semibold"
              style={{ background: RATING_COLOR[health.rating], color: '#FBF7EE' }}>
              {health.rating}
            </span>
          </div>
        </header>

        {/* 1. Executive summary */}
        <section className="report-section space-y-2">
          <h2 className="type-h2">Executive summary</h2>
          <p className="text-[15px] leading-relaxed">
            For fiscal year {fyLabel}, the town appropriated <b>{fmtUSD(approved)}</b> across all funds. Through
            {' '}{budget.period.asOf}, <b>{fmtUSD(actual)}</b> has been spent ({utilized}% of budget) and a further
            {' '}<b>{fmtUSD(committed)}</b> is committed to open purchase orders, leaving <b>{fmtUSD(remaining)}</b> available.
            Spending is {yoyPct >= 0 ? 'up' : 'down'} <b>{Math.abs(yoyPct)}%</b> versus the same point last year.
            Overall budget health is <b>{health.rating}</b>: {health.counts['At Risk']} department(s) at risk,
            {' '}{health.counts['Watch']} to watch, {health.counts['Healthy']} healthy.
          </p>
        </section>

        {/* 2. Budget vs actual by department */}
        <section className="report-section space-y-3">
          <h2 className="type-h2">Budget vs. actual by department</h2>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <th className="type-label py-2 px-3 text-left">Department</th>
                <th className="type-label py-2 px-3 text-left">Fund</th>
                <th className="type-label py-2 px-3 text-right">Approved</th>
                <th className="type-label py-2 px-3 text-right">YTD Actual</th>
                <th className="type-label py-2 px-3 text-right">Encumbered</th>
                <th className="type-label py-2 px-3 text-right">Remaining</th>
                <th className="type-label py-2 px-3 text-right">Utilized</th>
                <th className="type-label py-2 px-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => {
                const rem = l.budget - l.spent - l.encumbered;
                const pct = Math.round((l.spent / l.budget) * 100);
                const st  = status(l.spent, l.budget);
                return (
                  <tr key={l.name} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                    <td className="py-2 px-3 text-ink font-medium">{l.name}</td>
                    <td className="py-2 px-3 text-muted">{l.fund}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtUSD(l.budget)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtUSD(l.spent)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-muted">{fmtUSD(l.encumbered)}</td>
                    <td className={`py-2 px-3 text-right font-mono tabular-nums ${rem < 0 ? 'text-[#A8483A]' : ''}`}>{fmtUSD(rem)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{pct}%</td>
                    <td className="py-2 px-3 font-medium" style={{ color: statusColor[st.tone] }}>{st.label}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2" style={{ borderColor: 'var(--cc-line-strong)' }}>
                <td className="py-2 px-3 type-label" colSpan={2}>All funds</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-ink font-medium">{fmtUSD(approved)}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-ink font-medium">{fmtUSD(actual)}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-ink font-medium">{fmtUSD(committed)}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-ink font-medium">{fmtUSD(remaining)}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-ink font-medium">{utilized}%</td>
                <td className="py-2 px-3" />
              </tr>
            </tbody>
          </table>
        </section>

        {/* 3. Revenue vs expenditure & fund balance */}
        <section className="report-section space-y-3">
          <h2 className="type-h2">Revenue vs. expenditure and fund balance</h2>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <th className="type-label py-2 px-3 text-left">Fund</th>
                <th className="type-label py-2 px-3 text-right">Revenue</th>
                <th className="type-label py-2 px-3 text-right">Expenditure</th>
                <th className="type-label py-2 px-3 text-right">Net</th>
                <th className="type-label py-2 px-3 text-right">Ending Balance</th>
              </tr>
            </thead>
            <tbody>
              {funds.map(f => {
                const net = f.revenue - f.expenditure;
                return (
                  <tr key={f.fund} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                    <td className="py-2 px-3 text-ink font-medium">{f.fund}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtUSD(f.revenue)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtUSD(f.expenditure)}</td>
                    <td className={`py-2 px-3 text-right font-mono tabular-nums ${net < 0 ? 'text-[#A8483A]' : 'text-[#5F7E5A]'}`}>{net < 0 ? '-' : '+'}{fmtUSD(Math.abs(net))}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-ink font-medium">{fmtUSD(f.endingBalance)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2" style={{ borderColor: 'var(--cc-line-strong)' }}>
                <td className="py-2 px-3 type-label">Total</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-ink font-medium">{fmtUSD(fundTot.revenue)}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-ink font-medium">{fmtUSD(fundTot.expenditure)}</td>
                <td className={`py-2 px-3 text-right font-mono tabular-nums ${fundTot.revenue - fundTot.expenditure < 0 ? 'text-[#A8483A]' : 'text-[#5F7E5A]'}`}>{fundTot.revenue - fundTot.expenditure < 0 ? '-' : '+'}{fmtUSD(Math.abs(fundTot.revenue - fundTot.expenditure))}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-ink font-medium">{fmtUSD(fundTot.ending)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 4. Variance highlights */}
        <section className="report-section space-y-3">
          <h2 className="type-h2">Variance highlights</h2>
          {overBudget.length === 0 ? (
            <p className="text-[14px]">All departments are projected to finish within budget at the current pace.</p>
          ) : (
            <ul className="space-y-2">
              {overBudget.map(p => (
                <li key={p.name} className="text-[14px] flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: '#A8483A' }} />
                  <span>
                    <b>{p.name}</b> is projected to reach <b>{fmtUSD(p.projected)}</b> ({Math.round(p.projectedPct * 100)}% of its {fmtCompact(p.budget)} budget),
                    roughly <b>{fmtCompact(p.projected - p.budget)}</b> over allocation if spending continues at the current pace.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 5. Notable items */}
        <section className="report-section space-y-5">
          <h2 className="type-h2">Notable items</h2>

          <div>
            <h3 className="type-h3 mb-2">Top vendors by spend</h3>
            <table className="w-full text-[13px]">
              <tbody>
                {topVendors.map(v => (
                  <tr key={v.name} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                    <td className="py-1.5 px-3 text-ink">{v.name}</td>
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums">{fmtUSD(v.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="type-h3 mb-2">Flagged transactions ({flagged.length})</h3>
            {flagged.length === 0 ? (
              <p className="text-[13px] text-muted">No transactions flagged this period.</p>
            ) : (
              <ul className="space-y-1.5">
                {flagged.slice(0, 4).map((a, i) => (
                  <li key={i} className="text-[13px]">
                    <b>{a.kind}</b> — {a.vendor} ({a.dept}): {a.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="type-h3 mb-2">Budget amendments this period</h3>
            {budget.amendments.length === 0 ? (
              <p className="text-[13px] text-muted">None recorded this period.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                    <th className="type-label py-2 px-3 text-left">Date</th>
                    <th className="type-label py-2 px-3 text-left">Department</th>
                    <th className="type-label py-2 px-3 text-left">Type</th>
                    <th className="type-label py-2 px-3 text-right">Change</th>
                    <th className="type-label py-2 px-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {budget.amendments.map(a => (
                    <tr key={a.id} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                      <td className="py-1.5 px-3 text-muted">{fmtDate(a.date)}</td>
                      <td className="py-1.5 px-3 text-ink">{a.department}</td>
                      <td className="py-1.5 px-3">{a.type}</td>
                      <td className={`py-1.5 px-3 text-right font-mono tabular-nums ${a.delta < 0 ? 'text-[#A8483A]' : 'text-[#5F7E5A]'}`}>{a.delta < 0 ? '-' : '+'}{fmtUSD(Math.abs(a.delta))}</td>
                      <td className="py-1.5 px-3 text-muted">{a.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* 6. On-chain verification */}
        <section className="report-section rounded-md border p-5" style={{ borderColor: 'var(--cc-line)', background: 'var(--cc-tone-cream)' }}>
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} style={{ color: 'var(--cc-anchored)' }} className="mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="type-h3 mb-1">Verified on a public ledger</h3>
              <p className="text-[13px] leading-relaxed">
                Every payment behind these figures is written to a tamper-evident public ledger and anchored to a
                blockchain at each close of period, so the numbers in this report can be independently confirmed and
                have not been altered after publication.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="report-section pt-5 border-t text-[12px]" style={{ borderColor: 'var(--cc-line)', color: 'var(--cc-muted)' }}>
          Prepared by the Office of the Finance Director · Generated {today} · Figures as of {budget.period.asOf} · Powered by Civic-Chain
        </footer>
      </article>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportInner />
    </Suspense>
  );
}
