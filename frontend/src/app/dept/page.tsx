'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactECharts from 'echarts-for-react';
import { ExternalLink } from 'lucide-react';
import { Card, StatTile, BudgetBar, Badge, Button } from '@/components/cc';
import { getDepartmentAnalysis } from '@/lib/api';
import { fmtCompact, fmtUSD } from '@/lib/utils';
import type { DepartmentAnalysisResponse } from '@/types';

// Heatmap labels are abbreviated; map back to canonical department names so
// the Ledger filter matches (same contract as anomalies/page.tsx).
const DEPT_ALIAS: Record<string, string> = {
  'Pavement Sealing': 'Pavement Crack Sealing',
  'Dock Repairs':     'Dock Bulkhead Repairs',
};
const deptColors = ['#131F86', '#DFC28C', '#626C89', '#5F7E5A'];

export default function DeptPage() {
  const [data, setData] = useState<DepartmentAnalysisResponse | null>(null);
  const router = useRouter();

  useEffect(() => { getDepartmentAnalysis().then(setData); }, []);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="type-label animate-pulse">Loading department data…</div>
    </div>
  );

  const { departments, heatmap, byDept } = data;
  const top          = [...departments].sort((a, b) => b.spent - a.spent)[0];
  const atOver       = departments.filter(d => d.spent >= d.budget).length;
  const totalFlags   = departments.reduce((a, d) => a + d.anomalies, 0);

  // ---- ECharts: department × week heatmap --------------------------------
  const heatData: [number, number, number][] = [];
  heatmap.values.forEach((row, ri) => row.forEach((v, ci) => heatData.push([ci, ri, v])));
  const heatOption = {
    backgroundColor: 'transparent',
    grid: { top: 24, bottom: 40, left: 110, right: 24 },
    xAxis: { type: 'category', data: heatmap.cols, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#756B5B', fontSize: 11 } },
    yAxis: { type: 'category', data: heatmap.rows, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#14243F', fontSize: 12 } },
    visualMap: { min: 0, max: 3, show: false, inRange: { color: ['#E2E8DA', '#F0E6CF', '#F0DCD5', '#A8483A'] } },
    series: [{ type: 'heatmap', data: heatData, label: { show: true, formatter: ({ value }: { value: [number, number, number] }) => value[2] === 0 ? '' : String(value[2]), color: '#14243F', fontSize: 11 },
      itemStyle: { borderColor: '#FBF7EE', borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { shadowBlur: 10 } } }],
    tooltip: { backgroundColor: '#FBF7EE', borderColor: '#DDD3BE', textStyle: { color: '#14243F', fontSize: 12 }, formatter: ({ value }: { value: [number, number, number] }) => `${heatmap.rows[value[1]]} · ${heatmap.cols[value[0]]}: severity ${value[2]}` },
  };
  const onHeatClick = (params: { data?: [number, number, number] }) => {
    if (!params?.data) return;
    const label = heatmap.rows[params.data[1]];
    const dept  = DEPT_ALIAS[label] ?? label;
    router.push(`/ledger?dept=${encodeURIComponent(dept)}&flagged=1`);
  };

  // ---- ECharts: spend share by department --------------------------------
  const donutOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: '#FAF3E8', borderColor: '#DDD3BE', textStyle: { color: '#131F86' },
      formatter: (p: { name: string; value: number; percent: number }) => `${p.name}<br/><b>${fmtUSD(p.value)}</b> · ${p.percent}%` },
    legend: { orient: 'vertical', right: 8, top: 'center', textStyle: { color: '#5C6382', fontSize: 11, fontFamily: 'DM Sans' }, itemWidth: 10, itemHeight: 10 },
    series: [{ type: 'pie', radius: ['50%', '80%'], center: ['32%', '50%'], data: byDept, color: deptColors,
      label: { show: false }, emphasis: { label: { show: false } }, itemStyle: { borderColor: '#FBF7EE', borderWidth: 2 } }],
  };

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="type-label mb-1">Operations · FY2026</p>
          <h1 className="type-h1">Department Analysis</h1>
        </div>
        <Badge tone="info" dot={false}>{departments.length} departments</Badge>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Departments" value={departments.length} sub="Active cost centers" accent="var(--chart-1)" />
        <StatTile label="Highest Spend" value={top ? fmtCompact(top.spent) : '$0'} sub={top?.name} accent="var(--chart-2)" />
        <StatTile label="At / Over Budget" value={atOver} sub="Need review" accent="var(--chart-5)" />
        <StatTile label="Total Flags" value={totalFlags} sub="Across departments" accent="var(--cc-spike)" />
      </div>

      {/* Department cards */}
      <div className="grid grid-cols-2 gap-4">
        {departments.map(d => (
          <Card key={d.name} eyebrow={d.fund} title={d.name}
            actions={<Button size="sm" variant="ghost" href={`/ledger?dept=${encodeURIComponent(d.name)}`} icon={<ExternalLink size={13} />} iconRight>Ledger</Button>}>
            <div className="space-y-3">
              <BudgetBar label="Budget utilization" spent={d.spent} budget={d.budget} color={d.color} />
              <div className="flex items-center gap-4 pt-1">
                <div>
                  <p className="type-label">Transactions</p>
                  <p className="font-mono text-[18px] tabular-nums text-ink">{d.txns}</p>
                </div>
                <div>
                  <p className="type-label">Flags</p>
                  <p className="font-mono text-[18px] tabular-nums text-ink">{d.anomalies}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="type-label">Top vendor</p>
                  <p className="text-[13px] text-ink-soft truncate">{d.topVendor}</p>
                </div>
                {d.anomalies > 0 && <Badge tone="spike" dot>{d.anomalies} flag{d.anomalies > 1 ? 's' : ''}</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Heatmap + spend share */}
      <div className="grid grid-cols-3 gap-4">
        <Card eyebrow="Department × week risk" title="Spend Risk Heatmap" className="col-span-2" padded={false}>
          <div className="px-2"><ReactECharts option={heatOption} style={{ height: 240, cursor: 'pointer' }} onEvents={{ click: onHeatClick }} /></div>
          <p className="px-4 pb-3 text-[11px] text-muted">Click a cell to view that department&apos;s flagged transactions →</p>
        </Card>
        <Card eyebrow="Allocation" title="Spend Share" padded={false}>
          <ReactECharts option={donutOption} style={{ height: 240 }} />
        </Card>
      </div>

      {/* Comparison table */}
      <Card eyebrow="Side by side" title="Department Comparison" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                {['Department', 'Budget', 'Spent', 'Utilized', 'Txns', 'Flags', 'Top Vendor'].map((h, i) => (
                  <th key={h} className={`type-label py-2.5 px-4 ${i >= 1 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map(d => {
                const pct = Math.round((d.spent / d.budget) * 100);
                return (
                  <tr key={d.name}
                    onClick={() => router.push(`/ledger?dept=${encodeURIComponent(d.name)}`)}
                    className="border-b cursor-pointer transition-colors hover:bg-[#DBE3EE]/40"
                    style={{ borderColor: 'var(--cc-line)' }}>
                    <td className="py-2.5 px-4 text-ink font-medium">{d.name}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(d.budget)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(d.spent)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono tabular-nums ${pct >= 100 ? 'text-[#A8483A]' : 'text-ink-soft'}`}>{pct}%</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted">{d.txns}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-muted">{d.anomalies}</td>
                    <td className="py-2.5 px-4 text-ink-soft truncate max-w-[180px]">{d.topVendor}</td>
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
