'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Search, Download } from 'lucide-react';
import { Badge, Button, Input } from '@/components/cc';
import { getTransactions } from '@/lib/api';
import { fmtUSD, fmtDate, downloadCsv } from '@/lib/utils';
import type { Transaction } from '@/types';

// Public "open checkbook": a searchable, downloadable table of vendor payments,
// the most common real-world query on government transparency portals.
export function PublicCheckbook() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [q, setQ]       = useState('');
  const [dept, setDept] = useState('All departments');

  useEffect(() => { getTransactions().then(r => setRows(r.rows)); }, []);

  const depts = useMemo(
    () => ['All departments', ...Array.from(new Set(rows.map(t => t.department)))],
    [rows],
  );

  const filtered = useMemo(() => rows.filter(t =>
    (!q || t.vendor.toLowerCase().includes(q.toLowerCase()) || t.category.toLowerCase().includes(q.toLowerCase())) &&
    (dept === 'All departments' || t.department === dept)
  ), [rows, q, dept]);

  const total = filtered.reduce((a, t) => a + t.amount, 0);

  const exportCsv = () => {
    const header = ['Date', 'Vendor', 'Department', 'Category', 'Amount', 'Status'];
    const data = filtered.map(t => [t.date, t.vendor, t.department, t.category, t.amount, t.anchor === 'anchored' ? 'Verified' : 'Pending']);
    downloadCsv('anytown-payments.csv', [header, ...data]);
  };

  return (
    <section>
      <h2 className="type-h2 mb-1">Search every payment</h2>
      <p className="text-[13px] mb-4" style={{ color: 'var(--cc-muted)' }}>
        Every payment the town makes to a vendor or contractor. Search by vendor, department, or category. Payroll is reported separately.
      </p>

      <div className="rounded-md border" style={{ borderColor: 'var(--cc-line)', background: 'var(--cc-card)' }}>
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--cc-line)' }}>
          <Input icon={<Search size={14} />} placeholder="Search vendor or category…"
            value={q} onChange={e => setQ(e.target.value)} wrapStyle={{ flex: 1, minWidth: 220 }} />
          <select value={dept} onChange={e => setDept(e.target.value)}
            className="h-8 px-3 text-sm rounded-xs bg-[#FBF7EE] border border-[#DDD3BE] text-ink focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all duration-[120ms]">
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={exportCsv}>Download CSV</Button>
        </div>

        {/* Result summary */}
        <div className="flex items-center justify-between px-4 py-2 text-[12px]" style={{ color: 'var(--cc-muted)' }}>
          <span>{filtered.length} payment{filtered.length === 1 ? '' : 's'}</span>
          <span>Total <span className="font-mono tabular-nums text-ink-soft">{fmtUSD(total)}</span></span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-t border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <th className="type-label py-2 px-4 text-left">Date</th>
                <th className="type-label py-2 px-4 text-left">Vendor</th>
                <th className="type-label py-2 px-4 text-left">Department</th>
                <th className="type-label py-2 px-4 text-left">Category</th>
                <th className="type-label py-2 px-4 text-right">Amount</th>
                <th className="type-label py-2 px-4 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-6 px-4 text-center text-muted text-[13px]">No payments match your search.</td></tr>
              )}
              {filtered.map(t => (
                <tr key={t.id} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                  <td className="py-2 px-4 text-muted whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td className="py-2 px-4 text-ink font-medium">{t.vendor}</td>
                  <td className="py-2 px-4 text-muted">{t.department}</td>
                  <td className="py-2 px-4 text-muted">{t.category}</td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-ink-soft">{fmtUSD(t.amount)}</td>
                  <td className="py-2 px-4">
                    <Badge tone={t.anchor === 'anchored' ? 'anchored' : 'pending'} dot>{t.anchor === 'anchored' ? 'Verified' : 'Pending'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
