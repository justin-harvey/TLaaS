'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import '@ag-grid-community/styles/ag-grid.css';
import ReactECharts from 'echarts-for-react';
import { Search, X, Store } from 'lucide-react';
import { Card, StatTile, Badge, Button, Input, HashChip } from '@/components/cc';
import { getVendors, getTransactions } from '@/lib/api';
import { fmtUSD, fmtCompact, fmtDate } from '@/lib/utils';
import type { VendorsResponse, VendorSummary, Transaction } from '@/types';

// ---- Cell renderers -------------------------------------------------------
function AnomalyCell({ value }: { value: number }) {
  if (!value) return <span className="text-muted">None</span>;
  return <Badge tone="spike" dot>{value} flag{value > 1 ? 's' : ''}</Badge>;
}
function AnchorCell({ value }: { value: 'anchored' | 'pending' }) {
  return <Badge tone={value === 'anchored' ? 'anchored' : 'pending'} dot>{value === 'anchored' ? 'Anchored' : 'Pending'}</Badge>;
}

export default function VendorsPage() {
  const [data, setData]         = useState<VendorsResponse | null>(null);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<VendorSummary | null>(null);
  const [vendorTx, setVendorTx] = useState<Transaction[]>([]);
  const gridRef = useRef<AgGridReact>(null);

  useEffect(() => { getVendors().then(setData); }, []);

  // Load the selected vendor's transactions for the drawer.
  useEffect(() => {
    if (!selected) { setVendorTx([]); return; }
    getTransactions({ vendor: selected.vendor }).then(r => setVendorTx(r.rows));
  }, [selected]);

  const vendors = useMemo(
    () => !data ? [] : data.vendors.filter(v => !search || v.vendor.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );

  const colDefs = useMemo(() => [
    { field: 'vendor',    headerName: 'VENDOR',    flex: 1, minWidth: 190 },
    { field: 'category',  headerName: 'CATEGORY',  width: 130 },
    { field: 'mechanism', headerName: 'MECHANISM', width: 130 },
    { field: 'txns',      headerName: 'TXNS',      width: 90,  type: 'rightAligned', cellStyle: { fontFamily: 'IBM Plex Mono', fontSize: '12px' } },
    { field: 'total',     headerName: 'TOTAL SPEND', width: 130, type: 'rightAligned', cellStyle: { fontFamily: 'IBM Plex Mono', fontSize: '12px' }, cellRenderer: ({ value }: { value: number }) => fmtUSD(value) },
    { field: 'lastPaid',  headerName: 'LAST PAID', width: 120, cellRenderer: ({ value }: { value: string }) => fmtDate(value) },
    { field: 'anomalies', headerName: 'FLAGS',     width: 120, cellRenderer: AnomalyCell },
    { field: 'anchor',    headerName: 'ANCHOR',    width: 120, cellRenderer: AnchorCell },
  ], []);

  const onRowClicked = useCallback(({ data: row }: { data: VendorSummary }) => setSelected(row), []);

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="type-label animate-pulse">Loading vendor data…</div>
    </div>
  );

  const totalSpend = data.vendors.reduce((a, v) => a + v.total, 0);
  const flagged    = data.vendors.filter(v => v.anomalies > 0).length;
  const top        = data.vendors[0];

  // ---- ECharts: top vendors by spend (horizontal bar) --------------------
  const ranked = [...data.topVendors].reverse(); // ECharts bottom-to-top
  const barOption = {
    backgroundColor: 'transparent',
    grid: { top: 8, bottom: 24, left: 150, right: 24 },
    xAxis: { type: 'value', axisLabel: { color: '#5C6382', fontSize: 11, formatter: (v: number) => fmtCompact(v) }, splitLine: { lineStyle: { color: '#E3D9C4' } } },
    yAxis: { type: 'category', data: ranked.map(v => v.name), axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#14243F', fontSize: 11, fontFamily: 'DM Sans', formatter: (v: string) => v.length > 18 ? v.slice(0, 17) + '…' : v } },
    tooltip: { trigger: 'item', backgroundColor: '#FAF3E8', borderColor: '#DDD3BE', textStyle: { color: '#131F86' }, formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${fmtUSD(p.value)}</b>` },
    series: [{ type: 'bar', data: ranked.map(v => v.value), barWidth: '60%', itemStyle: { color: '#131F86', borderRadius: [0, 3, 3, 0] } }],
  };

  // ---- ECharts: payment-mechanism mix donut ------------------------------
  const mechColors = ['#131F86', '#DFC28C', '#D5DFD5', '#626C89'];
  const donutOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: '#FAF3E8', borderColor: '#DDD3BE', textStyle: { color: '#131F86' },
      formatter: (p: { name: string; value: number; percent: number }) => `${p.name}<br/><b>${fmtUSD(p.value)}</b> · ${p.percent}%` },
    legend: { orient: 'vertical', right: 8, top: 'center', textStyle: { color: '#5C6382', fontSize: 11, fontFamily: 'DM Sans' }, itemWidth: 10, itemHeight: 10 },
    series: [{ type: 'pie', radius: ['50%', '80%'], center: ['35%', '50%'], data: data.mechanismMix, color: mechColors,
      label: { show: false }, emphasis: { label: { show: false } }, itemStyle: { borderColor: '#FBF7EE', borderWidth: 2 } }],
  };

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="type-label mb-1">Procurement · FY2026</p>
          <h1 className="type-h1">Vendor Intelligence</h1>
        </div>
        <Badge tone={flagged ? 'spike' : 'anchored'} dot>{flagged} flagged vendor{flagged === 1 ? '' : 's'}</Badge>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Active Vendors" value={data.vendors.length} sub="With payments this year" accent="var(--chart-1)" />
        <StatTile label="Total Vendor Spend" value={fmtCompact(totalSpend)} sub="All mechanisms" accent="var(--chart-2)" />
        <StatTile label="Top Vendor" value={top ? fmtCompact(top.total) : '$0'} sub={top?.vendor} accent="var(--chart-3)" />
        <StatTile label="Flagged Vendors" value={flagged} sub="Have anomalies" accent="var(--chart-5)" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        <Card eyebrow="Spend ranking" title="Top Vendors by Spend" className="col-span-2" padded={false}>
          <div className="px-1"><ReactECharts option={barOption} style={{ height: 240 }} /></div>
        </Card>
        <Card eyebrow="Payment rails" title="Mechanism Mix" padded={false}>
          <ReactECharts option={donutOption} style={{ height: 240 }} />
        </Card>
      </div>

      {/* Search + vendor table */}
      <Card eyebrow="Vendor directory" title={`${vendors.length} vendor${vendors.length === 1 ? '' : 's'}`} padded={false}
        actions={
          <Input icon={<Search size={14} />} placeholder="Search vendor…" size="sm"
            value={search} onChange={e => setSearch(e.target.value)} wrapStyle={{ width: 220 }} />
        }>
        <div className="ag-theme-cc" style={{ height: 360 }}>
          <AgGridReact
            ref={gridRef}
            modules={[ClientSideRowModelModule]}
            rowData={vendors}
            columnDefs={colDefs}
            rowHeight={38}
            headerHeight={36}
            suppressCellFocus
            rowSelection="single"
            onRowClicked={onRowClicked}
            defaultColDef={{ resizable: true, sortable: true }}
          />
        </div>
      </Card>

      {/* Vendor detail drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-[#14243F]/28 z-30" onClick={() => setSelected(null)} />
          <aside className="fixed right-0 top-0 bottom-0 w-[460px] bg-[#FBF7EE] border-l border-[#C6B99E] shadow-lg z-40 cc-slide-in overflow-y-auto">
            <div className="flex items-center justify-between px-5 h-[56px] border-b border-[#DDD3BE] sticky top-0 bg-[#FBF7EE] z-10">
              <div className="flex items-center gap-2 min-w-0">
                <Store size={16} className="text-[#1B3D74] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="type-label">Vendor</p>
                  <p className="text-[15px] font-semibold text-ink truncate">{selected.vendor}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-xs hover:bg-[#DDD3BE] text-muted transition-colors"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge tone="info" dot={false}>{selected.mechanism}</Badge>
                <Badge tone={selected.anchor === 'anchored' ? 'anchored' : 'pending'} dot>{selected.anchor === 'anchored' ? 'Anchored' : 'Pending'}</Badge>
                {selected.anomalies > 0 && <Badge tone="spike" dot>{selected.anomalies} flag{selected.anomalies > 1 ? 's' : ''}</Badge>}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[
                  ['Total Spend', fmtUSD(selected.total)],
                  ['Transactions', String(selected.txns)],
                  ['Primary Category', selected.category],
                  ['Last Paid', fmtDate(selected.lastPaid)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="type-label mb-0.5">{label}</p>
                    <p className="text-[14px] text-ink font-medium">{value}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-[#DDD3BE]">
                <p className="type-label mb-2">Payments ({vendorTx.length})</p>
                <div className="space-y-0 -mx-1">
                  {vendorTx.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-1 h-[36px] border-b" style={{ borderColor: 'var(--cc-line)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[12px] text-muted font-mono tabular-nums">{fmtDate(t.date)}</span>
                        <span className="text-[12px] text-ink truncate">{t.department}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {t.anomaly && <Badge tone={t.anomaly === 'SPIKE' || t.anomaly === 'DUPLICATE' ? 'spike' : 'pending'} dot={false} style={{ fontSize: 10 }}>{t.anomaly}</Badge>}
                        <span className="text-[12px] font-mono tabular-nums text-ink-soft">{fmtUSD(t.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[#DDD3BE]">
                <p className="type-label mb-2">Latest record</p>
                {vendorTx[0] && <HashChip label="sha256" value={vendorTx[0].sha256} tone="info" />}
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
