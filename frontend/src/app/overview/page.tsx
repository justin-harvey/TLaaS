'use client';
import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Download, RefreshCw, Anchor } from 'lucide-react';
import { Card, StatTile, BudgetBar, Badge, Button, HashChip } from '@/components/cc';
import { getOverview } from '@/lib/api';
import { fmtCompact, fmtUSD, fmtDate } from '@/lib/utils';
import type { OverviewResponse } from '@/types';

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOverview().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="type-label animate-pulse">Loading ledger data…</div>
    </div>
  );

  const { kpis, trend, departments, recentAnchors, recentAnomalies } = data;

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

  // ---- ECharts: category donut -------------------------------------------
  const catSpend: Record<string, number> = {};
  recentAnchors.forEach(t => { catSpend[t.category] = (catSpend[t.category] || 0) + t.amount; });
  const donutData = Object.entries(catSpend).map(([name, value]) => ({ name, value }));
  const chartColors = ['#131F86', '#DFC28C', '#D5DFD5', '#DBE3EE', '#626C89', '#FAF3E8'];
  const donutOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#FAF3E8', borderColor: '#DDD3BE', textStyle: { color: '#131F86' },
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/><b>${fmtUSD(p.value)}</b> · ${p.percent}%`,
    },
    legend: { orient: 'vertical', right: 8, top: 'center', textStyle: { color: '#5C6382', fontSize: 11, fontFamily: 'DM Sans' }, itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie', radius: ['50%', '80%'], center: ['35%', '50%'],
      data: donutData, color: chartColors,
      label: { show: false }, emphasis: { label: { show: false } },
      itemStyle: { borderColor: '#FBF7EE', borderWidth: 2 },
    }],
  };

  const allocPct = ((kpis.allocated / kpis.mtaBalance) * 100).toFixed(0);
  const freePct  = ((kpis.unallocated / kpis.mtaBalance) * 100).toFixed(0);

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

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="MTA Balance" value={fmtCompact(kpis.mtaBalance)} sub="Municipal treasury account" accent="var(--chart-1)" />
        <StatTile label="Allocated" value={fmtCompact(kpis.allocated)} sub={`${allocPct}% of balance`} delta={allocPct + '%'} deltaTone="neutral" accent="var(--chart-2)" />
        <StatTile label="Unallocated" value={fmtCompact(kpis.unallocated)} sub={`${freePct}% available`} accent="var(--chart-3)" />
        <StatTile label="Card Pool Total" value={fmtCompact(kpis.cardPoolTotal)} sub="Active card programs" accent="var(--chart-4)" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        <Card eyebrow="Spend trend" title="Monthly Expenditure" className="col-span-2" padded={false}
          actions={<Button size="sm" variant="ghost">Full report</Button>}>
          <div className="px-1">
            <ReactECharts option={trendOption} style={{ height: 220 }} />
          </div>
        </Card>

        <Card eyebrow="Category breakdown" title="Spend by Category" padded={false}>
          <ReactECharts option={donutOption} style={{ height: 220 }} />
        </Card>
      </div>

      {/* Budget bars + feeds */}
      <div className="grid grid-cols-3 gap-4">
        <Card eyebrow="Budget vs Actual" title="Department Allocation" className="col-span-1">
          <div className="space-y-4">
            {departments.map(d => (
              <BudgetBar key={d.name} label={d.name} spent={d.spent} budget={d.budget} color={d.color} />
            ))}
          </div>
        </Card>

        {/* Recent anomalies */}
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

        {/* Recent anchors */}
        <Card eyebrow="On-chain records" title="Recent Anchors"
          actions={<Button size="sm" variant="ghost">Ledger</Button>}>
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
