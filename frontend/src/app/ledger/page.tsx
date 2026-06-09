'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import '@ag-grid-community/styles/ag-grid.css';
import { Search, SlidersHorizontal, X, ExternalLink } from 'lucide-react';
import { Badge, Button, Card, HashChip, Input, GovernancePanel } from '@/components/cc';
import { getTransactions } from '@/lib/api';
import { fmtUSD, fmtDate } from '@/lib/utils';
import type { Transaction } from '@/types';

// ---- Cell renderers -------------------------------------------------------
function AnchorCell({ value }: { value: 'anchored' | 'pending' }) {
  return <Badge tone={value === 'anchored' ? 'anchored' : 'pending'} dot>{value === 'anchored' ? 'Anchored' : 'Pending'}</Badge>;
}
function AnomalyCell({ value }: { value: string | null }) {
  if (!value) return null;
  const tone = value === 'SPIKE' || value === 'DUPLICATE' ? 'spike' : 'pending';
  return <Badge tone={tone}>{value}</Badge>;
}

export default function LedgerPage() {
  const [rows, setRows]           = useState<Transaction[]>([]);
  const [selected, setSelected]   = useState<Transaction | null>(null);
  const [search, setSearch]       = useState('');
  const gridRef = useRef<AgGridReact>(null);

  useEffect(() => { getTransactions().then(r => setRows(r.rows)); }, []);

  const filtered = useMemo(() =>
    rows.filter(r => !search || r.vendor.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const colDefs = useMemo(() => [
    { field: 'date',       headerName: 'DATE',       width: 110, cellRenderer: ({ value }: { value: string }) => fmtDate(value) },
    { field: 'id',         headerName: 'TX ID',      width: 110, cellStyle: { fontFamily: 'IBM Plex Mono', fontSize: '12px' } },
    { field: 'vendor',     headerName: 'VENDOR',     flex: 1 },
    { field: 'category',   headerName: 'CATEGORY',   width: 130 },
    { field: 'department', headerName: 'DEPT',       width: 130 },
    { field: 'amount',     headerName: 'AMOUNT',     width: 110, type: 'rightAligned', cellStyle: { fontFamily: 'IBM Plex Mono', fontSize: '12px' }, cellRenderer: ({ value }: { value: number }) => fmtUSD(value) },
    { field: 'anchor',     headerName: 'ANCHOR',     width: 120, cellRenderer: AnchorCell },
    { field: 'anomaly',    headerName: 'ANOMALY',    width: 120, cellRenderer: AnomalyCell },
  ], []);

  const onRowClicked = useCallback(({ data }: { data: Transaction }) => setSelected(data), []);

  return (
    <div className="max-w-[1280px] mx-auto space-y-4" style={{ height: 'calc(100vh - 96px)' }}>
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="type-label mb-1">Payments Cache · {filtered.length.toLocaleString()} records</p>
          <h1 className="type-h1">Ledger Explorer</h1>
        </div>
        <Button variant="secondary" size="sm" icon={<SlidersHorizontal size={13} />}>Filters</Button>
      </div>

      {/* Search bar */}
      <Input icon={<Search size={14} />} placeholder="Search vendor, category, TX id…"
        value={search} onChange={e => setSearch(e.target.value)} size="md" />

      {/* Grid + drawer */}
      <div className="flex gap-4 flex-1 overflow-hidden" style={{ height: 'calc(100% - 130px)' }}>
        <div className="flex-1 ag-theme-cc overflow-hidden rounded-md">
          <AgGridReact
            ref={gridRef}
            modules={[ClientSideRowModelModule]}
            rowData={filtered}
            columnDefs={colDefs}
            rowHeight={38}
            headerHeight={36}
            suppressCellFocus
            rowSelection="single"
            onRowClicked={onRowClicked}
            defaultColDef={{ resizable: true, sortable: true }}
          />
        </div>

        {/* Detail drawer */}
        {selected && (
          <>
            {/* Scrim */}
            <div className="fixed inset-0 bg-[#14243F]/28 z-30" onClick={() => setSelected(null)} />
            <aside className="fixed right-0 top-0 bottom-0 w-[460px] bg-[#FBF7EE] border-l border-[#C6B99E] shadow-lg z-40 cc-slide-in overflow-y-auto">
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 h-[56px] border-b border-[#DDD3BE] sticky top-0 bg-[#FBF7EE] z-10">
                <div>
                  <p className="type-label">Transaction detail</p>
                  <p className="text-[15px] font-semibold text-ink">{selected.id}</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-xs hover:bg-[#DDD3BE] text-muted transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge tone={selected.anchor === 'anchored' ? 'anchored' : 'pending'} dot>
                    {selected.anchor === 'anchored' ? 'Anchored' : 'Pending anchor'}
                  </Badge>
                  {selected.anomaly && <Badge tone={selected.anomaly === 'SPIKE' || selected.anomaly === 'DUPLICATE' ? 'spike' : 'pending'}>{selected.anomaly}</Badge>}
                  <Badge tone="info" dot={false}>MCC {selected.mcc}</Badge>
                </div>

                {/* Core fields */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {[
                    ['Date',       fmtDate(selected.date)],
                    ['Vendor',     selected.vendor],
                    ['Category',   selected.category],
                    ['Department', selected.department],
                    ['Amount',     fmtUSD(selected.amount)],
                    ['Status',     selected.anchor],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="type-label mb-0.5">{label}</p>
                      <p className="text-[14px] text-ink font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Hash chips */}
                <div className="space-y-2 pt-2 border-t border-[#DDD3BE]">
                  <p className="type-label">Cryptographic record</p>
                  <HashChip label="sha256"     value={selected.sha256}      tone="info" />
                  <HashChip label="fingerprint" value={selected.fingerprint} tone="neutral" />
                  <HashChip label="ledger_tx"  value={selected.ledgerTx}    tone="anchored"
                    href={`https://testnet.stellarchain.io/transactions/${selected.ledgerTx}`} />
                </div>

                {/* Raw JSON */}
                <div className="pt-2 border-t border-[#DDD3BE]">
                  <p className="type-label mb-2">Full record</p>
                  <pre className="text-[11px] font-mono bg-[#ECE2CE] rounded-xs p-3 overflow-auto max-h-48 text-ink-soft">
                    {JSON.stringify(selected, null, 2)}
                  </pre>
                </div>

                <Button full variant="secondary" icon={<ExternalLink size={13} />} iconRight
                  onClick={() => window.open(`https://testnet.stellarchain.io/transactions/${selected.ledgerTx}`, '_blank')}>
                  Open on blockchain explorer
                </Button>

                {/* Governance — wallet connect, override, and Close-of-Period */}
                <GovernancePanel
                  tenantId={1}
                  rowId={Number(selected.id.replace('TX-', ''))}
                  vendor={selected.vendor}
                  currentCategory={selected.category}
                  monthKey={selected.date.slice(0, 7)}
                  onOverrideSuccess={() => {
                    // Re-fetch ledger rows so the updated category shows immediately
                    getTransactions().then(r => setRows(r.rows));
                    setSelected(null);
                  }}
                />
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
