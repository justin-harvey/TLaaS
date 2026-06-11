'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactECharts from 'echarts-for-react';
import { AlertTriangle, Zap, Copy, TrendingUp, HelpCircle } from 'lucide-react';
import { Card, Badge, Button, HashChip } from '@/components/cc';
import { getAnomalies } from '@/lib/api';
import type { AnomaliesResponse } from '@/types';

// Heatmap row labels are abbreviated; map them back to the canonical
// department names used on transactions so the Ledger filter matches.
const DEPT_ALIAS: Record<string, string> = {
  'Pavement Sealing': 'Pavement Crack Sealing',
  'Dock Repairs':     'Dock Bulkhead Repairs',
};

const kindIcon: Record<string, React.ComponentType<{size?:number;className?:string}>> = {
  'Spend Spike':      Zap,
  'Duplicate Vendor': Copy,
  'Outlier Payment':  TrendingUp,
  'Suspicious MCC':   HelpCircle,
};
const kindCount = ['Spend Spikes', 'Duplicates', 'Outliers', 'Suspicious MCC'];

export default function AnomaliesPage() {
  const [data, setData] = useState<AnomaliesResponse | null>(null);
  const router = useRouter();

  useEffect(() => { getAnomalies().then(setData); }, []);
  if (!data) return <div className="flex items-center justify-center h-64"><p className="type-label animate-pulse">Loading anomalies…</p></div>;

  const { items, heatmap } = data;
  const spikes  = items.filter(a => a.kind === 'Spend Spike').length;
  const dupes   = items.filter(a => a.kind === 'Duplicate Vendor').length;
  const outliers= items.filter(a => a.kind === 'Outlier Payment').length;
  const mcc     = items.filter(a => a.kind === 'Suspicious MCC').length;

  // ---- Heatmap ECharts option -------------------------------------------
  const heatData: [number,number,number][] = [];
  heatmap.values.forEach((row, ri) => row.forEach((v, ci) => heatData.push([ci, ri, v])));
  const heatOption = {
    backgroundColor: 'transparent',
    grid: { top: 24, bottom: 40, left: 100, right: 24 },
    xAxis: { type: 'category', data: heatmap.cols, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#756B5B', fontSize: 11, fontFamily: 'IBM Plex Sans' } },
    yAxis: { type: 'category', data: heatmap.rows, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#14243F', fontSize: 12, fontFamily: 'IBM Plex Sans' } },
    visualMap: { min: 0, max: 3, show: false, inRange: { color: ['#E2E8DA', '#F0E6CF', '#F0DCD5', '#A8483A'] } },
    series: [{ type: 'heatmap', data: heatData, label: { show: true, formatter: ({ value }: { value: [number,number,number] }) => value[2] === 0 ? '' : value[2].toString(), color: '#14243F', fontSize: 11 }, emphasis: { itemStyle: { shadowBlur: 10 } }, itemStyle: { borderColor: '#FBF7EE', borderWidth: 2, borderRadius: 3 } }],
    tooltip: { backgroundColor: '#FBF7EE', borderColor: '#DDD3BE', textStyle: { color: '#14243F', fontSize: 12 }, formatter: ({ value }: { value: [number,number,number] }) => `${heatmap.rows[value[1]]} · ${heatmap.cols[value[0]]}: severity ${value[2]}` },
  };

  // Click a heatmap cell → Ledger filtered to that department's flagged rows.
  // (Weeks are synthetic severity buckets with no per-transaction date link,
  //  so we scope by department + flagged, not by week.)
  const onHeatClick = (params: { data?: [number, number, number] }) => {
    if (!params?.data) return;
    const [, ri] = params.data;
    const deptLabel = heatmap.rows[ri];
    const dept = DEPT_ALIAS[deptLabel] ?? deptLabel;
    router.push(`/ledger?dept=${encodeURIComponent(dept)}&flagged=1`);
  };

  const counts = [spikes, dupes, outliers, mcc];
  const countAccents = ['var(--chart-4)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-1)'];

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="type-label mb-1">Risk monitoring</p>
          <h1 className="type-h1">Anomaly Center</h1>
        </div>
        <Badge tone="spike" dot>{items.length} active flags</Badge>
      </div>

      {/* Count cards */}
      <div className="grid grid-cols-4 gap-4">
        {kindCount.map((label, i) => (
          <div key={label} className="bg-[#FBF7EE] border border-[#DDD3BE] rounded-md shadow-sm overflow-hidden">
            <div className="h-[3px]" style={{ background: countAccents[i] }} />
            <div className="p-4">
              <p className="type-label mb-2">{label}</p>
              <p className="font-mono text-[28px] font-medium tabular-nums text-ink">{counts[i]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap + triage */}
      <div className="grid grid-cols-3 gap-4">
        <Card eyebrow="Department × week risk" title="Spend Risk Heatmap" className="col-span-2" padded={false}>
          <div className="px-2">
            <ReactECharts option={heatOption} style={{ height: 260, cursor: 'pointer' }} onEvents={{ click: onHeatClick }} />
          </div>
          <p className="px-4 text-[11px] text-muted">Click a cell to view that department&apos;s flagged transactions →</p>
          <div className="px-4 pb-3 flex gap-3 items-center">
            {[['Low (1)', '#F0E6CF'], ['Medium (2)', '#F0DCD5'], ['High (3)', '#A8483A']].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-xs" style={{ background: color }} />
                <span className="text-[11px] text-muted">{label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Triage queue */}
        <Card eyebrow="Requires review" title="Triage Queue">
          <div className="space-y-3">
            {items.map((a, i) => {
              const Icon = kindIcon[a.kind] || AlertTriangle;
              return (
                <div key={i} className={`p-3 rounded-xs border ${a.tone === 'spike' ? 'bg-[#F0DCD5] border-[#A8483A]/25' : 'bg-[#F0E6CF] border-[#B8862B]/25'}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={13} className={`mt-0.5 flex-shrink-0 ${a.tone === 'spike' ? 'text-[#A8483A]' : 'text-[#B8862B]'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[13px] font-semibold text-ink truncate">{a.vendor}</span>
                        <Badge tone={a.tone === 'spike' ? 'spike' : 'pending'} dot={false} style={{ fontSize: 10 }}>{a.kind}</Badge>
                      </div>
                      <p className="text-[12px] text-muted leading-snug">{a.detail}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-muted">{a.dept}</span>
                        <HashChip value={a.tx} chars={6} tone="neutral" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
