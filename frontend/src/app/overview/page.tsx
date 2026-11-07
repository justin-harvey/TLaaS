'use client';
import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Download, RefreshCw, Anchor } from 'lucide-react';
import { Card, StatTile, Badge, Button, HashChip } from '@/components/cc';
import { getOverview, getBudgetAnalytics } from '@/lib/api';
import { computeBudgetHealth, overallRating, RATING_COLOR, RATING_TONE } from '@/lib/budget-health';
import { fmtCompact, fmtUSD } from '@/lib/utils';
import type { OverviewResponse, BudgetAnalyticsResponse } from '@/types';

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [budget, setBudget] = useState<BudgetAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOverview().then(d => { setData(d); setLoading(false); });
    getBudgetAnalytics().then(setBudget);
  }, []);

  if (loading || !data || !budget) return (
    <div className="flex items-center justify-center h-64">
      <div className="type-label animate-pulse">Loading ledger data…</div>
    </div>
  );

  const { kpis, trend, recentAnchors, recentAnomalies } = data;

  // Budget position (the power user's first question) from the Budget surface.
  const approved   = budget.lines.reduce((a, l) => a + l.budget, 0);
  const actual     = budget.lines.reduce((a, l) => a + l.spent, 0);
  const encumbered = budget.lines.reduce((a, l) => a + l.encumbered, 0);
  const remaining  = approved - actual - encumbered;
  const utilized   = approved ? Math.round((actual / approved) * 100) : 0;
  const priorActual = budget.lines.reduce((a, l) => a + (budget.prior[l.name] ?? 0), 0);
  const yoyPct      = priorActual ? Math.round(((actual - priorActual) / priorActual) * 100) : 0;

  // Budget health rolled up from the Budget Analytics surface (shared scoring).
  const deptAnomalies: Record<string, number> = {};
  recentAnomalies.forEach(a => { deptAnomalies[a.dept] = (deptAnomalies[a.dept] ?? 0) + 1; });
  const healthItems  = computeBudgetHealth(budget.lines, budget.period.fyElapsedPct, deptAnomalies);
  const health       = overallRating(healthItems);
  const flaggedDepts = healthItems.filter(i => i.rating !== 'Healthy');

  // ---- ECharts: area-line spend trend ------------------------------------
  const trendOption = {
    backgroundColor: 'transparent',
    grid: { top: 16, bottom: 32, left: 40, right: 16 },
    xAxis: { type: 'category', data: trend.months, axisLine: { lineStyle: { color: '#DDD3BE' } }, axisLabel: { color: '#5C6382', fontSize: 11 }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: '#5C6382', fontSize: 11, formatter: (v: number) => `$${v}M` }, splitLine: { lineStyle: { color: '#E3D9C4' } }, axisLine: { show: false } },
    series: [{
      type: 'line', smooth: 0.3, data: trend.values, symbol: 'circle', symbolSize: 6,
      itemStyle: { color: '#131F86' }, lineStyle: { color: '#131F86', width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(19,31,134,0.15)' }, { offset: 1, color: 'rgba(19,31,134,0)' }] } },
    }],
    tooltip: { backgroundColor: '#FAF3E8', borderColor: '#DDD3BE', textStyle: { color: '#131F86', fontFamily: 'DM Sans' }, formatter: (p: { name: string; value: number }) => `${p.name}: $${p.value}M` },
  };

  const allocPct = ((kpis.allocated / kpis.mtaBalance) * 100).toFixed(0);
  const freePct  = ((kpis.unallocated / kpis.mtaBalance) * 100).toFixed(0);
  const treasury: [string, string, string][] = [
    ['MTA Balance', fmtUSD(kpis.mtaBalance), 'Municipal treasury account'],
    ['Allocated', fmtUSD(kpis.allocated), `${allocPct}% of balance`],
    ['Unallocated', fmtUSD(kpis.unallocated), `${freePct}% available`],
  ];

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="type-label mb-1">Municipal Finance · FY2026</p>
          <h1 className="type-h1">Executive Overview</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />}>Refresh</Button>
          <Button variant="secondary" size="sm" icon={<Download size={13} />}>Export</Button>
        </div>
      </div>

      {/* Budget position KPIs (the power user's first question) */}
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Approved Budget" value={fmtCompact(approved)} sub="FY2026 appropriation" accent="var(--chart-1)" />
        <StatTile label="YTD Actual Spend" value={fmtCompact(actual)} sub={`${utilized}% utilized`} delta={`${yoyPct >= 0 ? '+' : ''}${yoyPct}% YoY`} deltaTone="neutral" accent="var(--chart-2)" />
        <StatTile label="Encumbrances" value={fmtCompact(encumbered)} sub="Open commitments" accent="var(--chart-3)" />
        <StatTile label="Remaining Balance" value={fmtCompact(remaining)} sub={`${100 - utilized}% of budget`} accent="var(--chart-4)" />
      </div>

      {/* Fiscal health (rolled up from Budget Analytics) */}
      <Card eyebrow="Fiscal health" title="Budget Health"
        actions={<Button size="sm" variant="ghost" href="/budget">Budget analytics</Button>}>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[15px] font-semibold"
            style={{ background: RATING_COLOR[health.rating], color: '#FBF7EE' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#FBF7EE' }} /> {health.rating}
          </span>
          <p className="text-[13px] text-muted">
            {health.counts['At Risk']} at risk · {health.counts['Watch']} watch · {health.counts['Healthy']} healthy
          </p>
          {flaggedDepts.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {flaggedDepts.map(i => (
                <span key={i.name} className="inline-flex items-center gap-1.5 text-[12px] px-2 py-1 rounded-xs"
                  style={{ background: 'var(--cc-paper-deep)', color: 'var(--cc-ink-soft)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: RATING_COLOR[i.rating] }} /> {i.name}
                  <Badge tone={RATING_TONE[i.rating]} dot={false} style={{ fontSize: 10 }}>{i.rating}</Badge>
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Trend + what-needs-attention */}
      <div className="grid grid-cols-3 gap-4">
        <Card eyebrow="Spend trend" title="Monthly Expenditure" className="col-span-2" padded={false}
          actions={<Button size="sm" variant="ghost" href="/budget">Full report</Button>}>
          <div className="px-1">
            <ReactECharts option={trendOption} style={{ height: 220 }} />
          </div>
        </Card>

        <Card eyebrow="Risk signals" title="Anomaly Feed"
          actions={<Button size="sm" variant="ghost" href="/anomalies">View all</Button>}>
          <div className="space-y-2.5">
            {recentAnomalies.map((a, i) => (
              <div key={i} className={`p-3 rounded-xs border text-sm ${a.tone === 'spike' ? 'bg-[#F0DCD5] border-[#A8483A]/20' : 'bg-[#F0E6CF] border-[#B8862B]/20'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-ink">{a.vendor}</span>
                  <Badge tone={a.tone === 'spike' ? 'spike' : 'pending'} dot>{a.kind}</Badge>
                </div>
                <p className="text-[12px] text-muted">{a.detail}</p>
                <p className="text-[11px] font-mono text-muted mt-1 opacity-70">{a.dept} · {a.tx}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Treasury (secondary) + on-chain records */}
      <div className="grid grid-cols-3 gap-4">
        <Card eyebrow="Treasury" title="Account Position" className="col-span-1">
          <div className="space-y-3">
            {treasury.map(([label, val, sub]) => (
              <div key={label} className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-ink-soft font-medium">{label}</p>
                  <p className="text-[11px] text-muted">{sub}</p>
                </div>
                <span className="font-mono text-[15px] tabular-nums text-ink">{val}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card eyebrow="On-chain records" title="Recent Anchors" className="col-span-2"
          actions={<Button size="sm" variant="ghost" href="/ledger">Ledger</Button>}>
          <div className="space-y-0 -mx-4">
            {recentAnchors.map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 h-[38px] border-b hover:bg-[#DBE3EE]/40 transition-colors group cursor-default" style={{ borderColor: 'var(--cc-line)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <Anchor size={11} className="text-[#5F7E5A] flex-shrink-0" />
                  <span className="text-[13px] text-ink truncate">{t.vendor}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="font-mono text-[12px] text-muted tabular-nums">{fmtUSD(t.amount)}</span>
                  <HashChip value={t.sha256} tone="anchored" chars={4} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
