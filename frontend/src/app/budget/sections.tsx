'use client';
import React from 'react';
import ReactECharts from 'echarts-for-react';
import { CheckCircle2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, Badge, Button } from '@/components/cc';
import { fmtUSD, fmtCompact, fmtDate } from '@/lib/utils';
import { status } from '@/lib/budget-health';
import type { OpenCommitment, FundSummary, BudgetAmendment, BudgetLine, Fund } from '@/types';

const chartColors = ['#131F86', '#DFC28C', '#D5DFD5', '#DBE3EE', '#626C89', '#FAF3E8'];
const paceMeta: Record<'under' | 'on' | 'over', { tone: 'anchored' | 'info' | 'spike'; label: string }> = {
  under: { tone: 'anchored', label: 'Under pace' },
  on:    { tone: 'info',     label: 'On pace' },
  over:  { tone: 'spike',    label: 'Over pace' },
};

// Re-exported from lib/budget-health so the budget page's existing import keeps working.
export { status };

export interface ProjectionLine extends BudgetLine { projected: number; projectedPct: number; pace: 'under' | 'on' | 'over'; }
export interface Mover { name: string; cur: number; prev: number; change: number; }
export interface CategoryVendor { vendor: string; txns: number; total: number; }

/* =========================================================
   Open Commitments — the purchase orders behind encumbrances
   ========================================================= */
export function OpenCommitments({ commitments }: { commitments: OpenCommitment[] }) {
  const total = commitments.reduce((a, c) => a + c.amount, 0);
  return (
    <Card eyebrow="Encumbrance detail" title={`Open Commitments · ${fmtCompact(total)}`} padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
              <th className="type-label py-2.5 px-4 text-left">PO</th>
              <th className="type-label py-2.5 px-4 text-left">Vendor</th>
              <th className="type-label py-2.5 px-4 text-left">Department</th>
              <th className="type-label py-2.5 px-4 text-left">Issued</th>
              <th className="type-label py-2.5 px-4 text-right">Amount</th>
              <th className="type-label py-2.5 px-4 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {commitments.length === 0 && (
              <tr><td colSpan={6} className="py-4 px-4 text-muted text-[13px]">No open commitments for this view.</td></tr>
            )}
            {commitments.map(c => (
              <tr key={c.id} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <td className="py-2.5 px-4 font-mono text-[12px] text-ink-soft">{c.id}</td>
                <td className="py-2.5 px-4 text-ink font-medium">{c.vendor}</td>
                <td className="py-2.5 px-4 text-muted">{c.department}</td>
                <td className="py-2.5 px-4 text-muted">{fmtDate(c.issued)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(c.amount)}</td>
                <td className="py-2.5 px-4">
                  <Badge tone={c.status === 'Open' ? 'info' : 'pending'} dot={false}>{c.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* =========================================================
   Revenue vs Expenditure — the revenue side and fund balance
   ========================================================= */
export function RevenueVsExpenditure({ funds }: { funds: FundSummary[] }) {
  const tot = funds.reduce(
    (a, f) => ({ revenue: a.revenue + f.revenue, expenditure: a.expenditure + f.expenditure, ending: a.ending + f.endingBalance }),
    { revenue: 0, expenditure: 0, ending: 0 },
  );
  const netCell = (n: number) => (
    <span className={`font-mono tabular-nums ${n < 0 ? 'text-[#A8483A]' : 'text-[#5F7E5A]'}`}>
      {n < 0 ? '-' : '+'}{fmtUSD(Math.abs(n))}
    </span>
  );
  return (
    <Card eyebrow="Fund accounting" title="Revenue vs. Expenditure" padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
              <th className="type-label py-2.5 px-4 text-left">Fund</th>
              <th className="type-label py-2.5 px-4 text-right">Revenue</th>
              <th className="type-label py-2.5 px-4 text-right">Expenditure</th>
              <th className="type-label py-2.5 px-4 text-right">Net</th>
              <th className="type-label py-2.5 px-4 text-right">Ending Balance</th>
            </tr>
          </thead>
          <tbody>
            {funds.map(f => (
              <tr key={f.fund} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <td className="py-2.5 px-4 text-ink font-medium">{f.fund}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(f.revenue)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(f.expenditure)}</td>
                <td className="py-2.5 px-4 text-right">{netCell(f.revenue - f.expenditure)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink font-medium">{fmtUSD(f.endingBalance)}</td>
              </tr>
            ))}
            {funds.length > 1 && (
              <tr className="border-t-2" style={{ borderColor: 'var(--cc-line-strong)' }}>
                <td className="py-2.5 px-4 type-label">Total</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(tot.revenue)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(tot.expenditure)}</td>
                <td className="py-2.5 px-4 text-right">{netCell(tot.revenue - tot.expenditure)}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink font-medium">{fmtUSD(tot.ending)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* =========================================================
   Amendments Log — mid-year appropriation changes
   ========================================================= */
export function AmendmentsLog({ amendments }: { amendments: BudgetAmendment[] }) {
  const typeTone = { Increase: 'anchored', Decrease: 'spike', Transfer: 'info' } as const;
  return (
    <Card eyebrow="Appropriation changes" title="Budget Amendments & Transfers" padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
              <th className="type-label py-2.5 px-4 text-left">Date</th>
              <th className="type-label py-2.5 px-4 text-left">ID</th>
              <th className="type-label py-2.5 px-4 text-left">Department</th>
              <th className="type-label py-2.5 px-4 text-left">Type</th>
              <th className="type-label py-2.5 px-4 text-right">Change</th>
              <th className="type-label py-2.5 px-4 text-left">Reason</th>
              <th className="type-label py-2.5 px-4 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {amendments.length === 0 && (
              <tr><td colSpan={7} className="py-4 px-4 text-muted text-[13px]">No amendments recorded for this view.</td></tr>
            )}
            {amendments.map(a => (
              <tr key={a.id} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <td className="py-2.5 px-4 text-muted">{fmtDate(a.date)}</td>
                <td className="py-2.5 px-4 font-mono text-[12px] text-ink-soft">{a.id}</td>
                <td className="py-2.5 px-4 text-ink font-medium">{a.department}</td>
                <td className="py-2.5 px-4"><Badge tone={typeTone[a.type]} dot={false}>{a.type}</Badge></td>
                <td className={`py-2.5 px-4 text-right font-mono tabular-nums ${a.delta < 0 ? 'text-[#A8483A]' : 'text-[#5F7E5A]'}`}>{a.delta < 0 ? '-' : '+'}{fmtUSD(Math.abs(a.delta))}</td>
                <td className="py-2.5 px-4 text-muted">{a.reason}</td>
                <td className="py-2.5 px-4"><Badge tone={a.status === 'Approved' ? 'anchored' : 'pending'} dot>{a.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* =========================================================
   Year-End Projection — burn-rate forecast + pacing table
   ========================================================= */
export function YearEndProjection({ projections, projTotal, approved, asOf, fyElapsed, onRowClick }: {
  projections: ProjectionLine[]; projTotal: number; approved: number; asOf: string; fyElapsed: number; onRowClick: (name: string) => void;
}) {
  const over = projections.filter(p => p.projectedPct > 1.02);
  return (
    <Card eyebrow={`Forecast · as of ${asOf} · ${Math.round(fyElapsed * 100)}% of FY elapsed`}
      title="Year-End Projection" padded={false}
      actions={
        <div className="flex items-center gap-3 text-[12px]">
          {over.length > 0
            ? <span className="font-medium text-[#A8483A]">{over.length} projected over budget</span>
            : <span className="inline-flex items-center gap-1 text-[#5F7E5A]"><CheckCircle2 size={13} /> all within budget</span>}
          <span className="text-muted">Projected <span className="font-mono text-ink-soft">{fmtCompact(projTotal)}</span> / {fmtCompact(approved)}</span>
        </div>
      }>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
              <th className="type-label py-2.5 px-4 text-left">Department</th>
              <th className="type-label py-2.5 px-4 text-right">Utilized</th>
              <th className="type-label py-2.5 px-4 text-left">Pace</th>
              <th className="type-label py-2.5 px-4 text-right">Projected Year-End</th>
              <th className="type-label py-2.5 px-4 text-right">vs Budget</th>
            </tr>
          </thead>
          <tbody>
            {projections.map(h => {
              const pm = paceMeta[h.pace];
              const isOver = h.projectedPct > 1.02;
              return (
                <tr key={h.name} onClick={() => onRowClick(h.name)}
                  className={`border-b cursor-pointer transition-colors ${isOver ? 'bg-[#F0DCD5]/50' : 'hover:bg-[#DBE3EE]/40'}`}
                  style={{ borderColor: 'var(--cc-line)' }}>
                  <td className="py-2.5 px-4 text-ink font-medium">{h.name}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{Math.round((h.spent / h.budget) * 100)}%</td>
                  <td className="py-2.5 px-4"><Badge tone={pm.tone} dot={false}>{pm.label}</Badge></td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(h.projected)}</td>
                  <td className={`py-2.5 px-4 text-right font-mono tabular-nums ${h.projectedPct > 1 ? 'text-[#A8483A]' : 'text-[#5F7E5A]'}`}>{Math.round(h.projectedPct * 100)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* =========================================================
   Top Movers — year-over-year change per department
   ========================================================= */
export function TopMovers({ movers, asOf }: { movers: Mover[]; asOf: string }) {
  return (
    <Card eyebrow={`Year over year · YTD through ${asOf}`} title="Top Movers" padded={false}>
      <div className="grid grid-cols-4 gap-px" style={{ background: 'var(--cc-line)' }}>
        {movers.map(m => {
          const up = m.change >= 0;
          return (
            <div key={m.name} className="bg-[#FBF7EE] p-4">
              <p className="type-label mb-1.5 truncate">{m.name}</p>
              <div className="flex items-center gap-1">
                {up ? <ArrowUpRight size={16} className="text-[#A8483A]" /> : <ArrowDownRight size={16} className="text-[#5F7E5A]" />}
                <span className={`font-mono text-[20px] tabular-nums ${up ? 'text-[#A8483A]' : 'text-[#5F7E5A]'}`}>{up ? '+' : ''}{Math.round(m.change * 100)}%</span>
              </div>
              <p className="text-[11px] text-muted mt-1">{fmtCompact(m.cur)} vs {fmtCompact(m.prev)} prior</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* =========================================================
   Spend Charts — cumulative trend + category donut (drillable)
   ========================================================= */
export function SpendCharts({ trend, byCategory, onCategorySelect }: {
  trend: { months: string[]; budget: number[]; actual: number[] };
  byCategory: { name: string; value: number }[];
  onCategorySelect: (name: string | undefined) => void;
}) {
  const trendOption = {
    backgroundColor: 'transparent',
    grid: { top: 24, bottom: 32, left: 40, right: 16 },
    legend: { top: 0, right: 8, itemWidth: 12, itemHeight: 8, textStyle: { color: '#5C6382', fontSize: 11, fontFamily: 'DM Sans' } },
    xAxis: { type: 'category', data: trend.months, axisLine: { lineStyle: { color: '#DDD3BE' } }, axisLabel: { color: '#5C6382', fontSize: 11 }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: '#5C6382', fontSize: 11, formatter: (v: number) => `$${v}M` }, splitLine: { lineStyle: { color: '#E3D9C4' } }, axisLine: { show: false } },
    tooltip: { trigger: 'axis', backgroundColor: '#FAF3E8', borderColor: '#DDD3BE', textStyle: { color: '#131F86', fontFamily: 'DM Sans' }, valueFormatter: (v: number) => `$${v}M` },
    series: [
      { name: 'Budget', type: 'line', smooth: 0.3, data: trend.budget, symbol: 'none', lineStyle: { color: '#B8862B', width: 2, type: 'dashed' }, itemStyle: { color: '#B8862B' } },
      { name: 'Actual', type: 'line', smooth: 0.3, data: trend.actual, symbol: 'circle', symbolSize: 6, itemStyle: { color: '#131F86' }, lineStyle: { color: '#131F86', width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(19,31,134,0.15)' }, { offset: 1, color: 'rgba(19,31,134,0)' }] } } },
    ],
  };
  const donutOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: '#FAF3E8', borderColor: '#DDD3BE', textStyle: { color: '#131F86' },
      formatter: (p: { name: string; value: number; percent: number }) => `${p.name}<br/><b>${fmtUSD(p.value)}</b> · ${p.percent}%` },
    legend: { orient: 'vertical', right: 8, top: 'center', textStyle: { color: '#5C6382', fontSize: 11, fontFamily: 'DM Sans' }, itemWidth: 10, itemHeight: 10 },
    series: [{ type: 'pie', radius: ['50%', '80%'], center: ['35%', '50%'], data: byCategory, color: chartColors,
      label: { show: false }, emphasis: { label: { show: false } },
      itemStyle: { borderColor: '#FBF7EE', borderWidth: 2 },
      selectedMode: 'single' as const }],
  };
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card eyebrow="Budget vs. Actual" title="Cumulative Spend" className="col-span-2" padded={false}
        actions={<Button size="sm" variant="ghost">Full report</Button>}>
        <div className="px-1"><ReactECharts option={trendOption} style={{ height: 240 }} /></div>
      </Card>

      <Card eyebrow="Category breakdown" title="Spend by Category" padded={false}>
        <ReactECharts option={donutOption} style={{ height: 220 }}
          onEvents={{ click: (p: { name?: string }) => onCategorySelect(p.name) }} />
        <p className="px-4 pb-3 text-[11px] text-muted no-print">Click a slice to drill into its vendors →</p>
      </Card>
    </div>
  );
}

/* =========================================================
   Category Drill — vendors inside a drilled category
   ========================================================= */
export function CategoryDrill({ fund, category, vendors }: {
  fund: Fund | 'All Funds'; category: string; vendors: CategoryVendor[];
}) {
  return (
    <Card eyebrow={`Drill-down · ${fund} › ${category}`} title={`Vendors in ${category}`} padded={false}
      actions={<Button size="sm" variant="ghost" href="/vendors">Open Vendor Intelligence</Button>}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
              <th className="type-label py-2.5 px-4 text-left">Vendor</th>
              <th className="type-label py-2.5 px-4 text-right">Payments</th>
              <th className="type-label py-2.5 px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 && (
              <tr><td colSpan={3} className="py-4 px-4 text-muted text-[13px]">No vendors in this category for the selected fund.</td></tr>
            )}
            {vendors.map(v => (
              <tr key={v.vendor} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <td className="py-2.5 px-4 text-ink font-medium">{v.vendor}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted">{v.txns}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* =========================================================
   Department Budgets — budget bars + appropriation table
   ========================================================= */
export function DepartmentBudgets({ lines, onRowClick }: { lines: BudgetLine[]; onRowClick: (name: string) => void }) {
  return (
    <Card eyebrow="Appropriation detail" title="Department Budgets" padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
              {['Department', 'Fund', 'Approved', 'YTD Actual', 'Encumbered', 'Remaining', 'Utilized', 'Status'].map((h, i) => (
                <th key={h} className={`type-label py-2.5 px-4 ${i >= 2 && i <= 6 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={8} className="py-4 px-4 text-muted text-[13px]">No departments in this fund.</td></tr>
            )}
            {lines.map(l => {
              const rem = l.budget - l.spent - l.encumbered;
              const pct = Math.round((l.spent / l.budget) * 100);
              const st  = status(l.spent, l.budget);
              return (
                <tr key={l.name} onClick={() => onRowClick(l.name)}
                  className="border-b cursor-pointer transition-colors hover:bg-[#DBE3EE]/40"
                  style={{ borderColor: 'var(--cc-line)' }}>
                  <td className="py-2.5 px-4 text-ink font-medium">{l.name}</td>
                  <td className="py-2.5 px-4 text-muted">{l.fund}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(l.budget)}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(l.spent)}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted">{fmtUSD(l.encumbered)}</td>
                  <td className={`py-2.5 px-4 text-right font-mono tabular-nums ${rem < 0 ? 'text-[#A8483A]' : 'text-ink-soft'}`}>{fmtUSD(rem)}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{pct}%</td>
                  <td className="py-2.5 px-4"><Badge tone={st.tone} dot={false}>{st.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
