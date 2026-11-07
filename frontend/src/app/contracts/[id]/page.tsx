'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Card, Badge, Button, HashChip } from '@/components/cc';
import { getContract } from '@/lib/api';
import { explainFlag, FLAG_LABEL, FLAG_TONE } from '@/lib/contracts';
import { fmtUSD, fmtCompact, fmtDate } from '@/lib/utils';
import type { ContractDetail, ContractStatus } from '@/types';

const STATUS_TONE: Record<ContractStatus, 'info' | 'pending' | 'spike' | 'neutral'> = {
  Active: 'info', Expiring: 'pending', Expired: 'spike', Closed: 'neutral',
};

export default function ContractDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const [c, setC] = useState<ContractDetail | null | undefined>(undefined);

  useEffect(() => { getContract(id).then(setC); }, [id]);

  if (c === undefined) return (
    <div className="flex items-center justify-center h-64">
      <div className="type-label animate-pulse">Loading contract…</div>
    </div>
  );
  if (c === null) return (
    <div className="max-w-[820px] mx-auto py-16 text-center space-y-3">
      <p className="type-h2">Contract not found</p>
      <Link href="/contracts" className="text-[13px] text-blue-500 hover:text-blue-700">Back to contracts</Link>
    </div>
  );

  const over     = c.utilizedPct > 1;
  const near     = !over && c.utilizedPct >= 0.85;
  const barColor = over ? '#A8483A' : near ? '#B8862B' : '#5F7E5A';

  const terms: [string, React.ReactNode][] = [
    ['Vendor', c.vendor],
    ['Department', c.department],
    ['Fund', c.fund],
    ['Type', c.type],
    ['Contract number', <span key="n" className="font-mono">{c.id}</span>],
    ['Awarded', fmtDate(c.awardDate)],
    ['Term', `${fmtDate(c.startDate)} to ${fmtDate(c.endDate)}`],
    ['Per-payment ceiling', fmtUSD(c.poCeiling)],
  ];

  return (
    <div className="max-w-[920px] mx-auto space-y-6">

      {/* Controls (hidden in print) */}
      <div className="flex items-center justify-between no-print">
        <Link href="/contracts" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink transition-colors">
          <ArrowLeft size={14} /> Back to contracts
        </Link>
        <Button size="sm" icon={<Printer size={13} />} onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--cc-line-strong)' }}>
        <div>
          <p className="type-label mb-1">Contract · {c.id}</p>
          <h1 className="type-h1">{c.title}</h1>
          <p className="text-[14px] text-muted mt-1.5">{c.vendor} · {c.department}</p>
        </div>
        <Badge tone={STATUS_TONE[c.status]} dot>{c.status}</Badge>
      </div>

      {/* Hero: not-to-exceed burn */}
      <Card eyebrow="Not-to-exceed authority" title="Spending vs. Ceiling" padded={false}>
        <div className="p-5 space-y-4">
          <div className="flex items-end justify-between flex-wrap gap-2">
            <div>
              <p className="font-mono text-[30px] tabular-nums leading-none" style={{ color: 'var(--cc-ink)' }}>{fmtUSD(c.spent)}</p>
              <p className="text-[12px] text-muted mt-1">spent of {fmtUSD(c.value)} not-to-exceed</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[22px] tabular-nums" style={{ color: barColor }}>{Math.round(c.utilizedPct * 100)}%</p>
              <p className="text-[12px]" style={{ color: over ? '#A8483A' : 'var(--cc-muted)' }}>
                {over ? `${fmtUSD(c.spent - c.value)} over ceiling` : `${fmtUSD(c.remaining)} remaining`}
              </p>
            </div>
          </div>
          <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: 'var(--cc-line)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(c.utilizedPct, 1) * 100}%`, background: barColor }} />
          </div>
        </div>
      </Card>

      {/* Attention flags */}
      {c.flags.length > 0 && (
        <Card eyebrow="Needs attention" title="Compliance flags">
          <div className="space-y-2.5">
            {c.flags.map(f => (
              <div key={f} className="flex items-start gap-3">
                <Badge tone={FLAG_TONE[f]} dot={false}>{FLAG_LABEL[f]}</Badge>
                <p className="text-[13px] text-ink-soft">{explainFlag(f, c)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Terms & parties */}
      <Card eyebrow="Contract terms" title="Terms & Parties">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {terms.map(([label, val]) => (
            <div key={label}>
              <p className="type-label mb-0.5">{label}</p>
              <p className="text-[14px] text-ink">{val}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment trail — the verifiable record */}
      <Card eyebrow="Verifiable record" title={`Payment Trail · ${c.payments.length} payment${c.payments.length === 1 ? '' : 's'}`} padded={false}
        actions={<Button size="sm" variant="secondary" href="/verify" icon={<ShieldCheck size={13} />}>Verify a record</Button>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                <th className="type-label py-2.5 px-4 text-left">Date</th>
                <th className="type-label py-2.5 px-4 text-left">Category</th>
                <th className="type-label py-2.5 px-4 text-right">Amount</th>
                <th className="type-label py-2.5 px-4 text-left">Status</th>
                <th className="type-label py-2.5 px-4 text-left">On-chain proof</th>
              </tr>
            </thead>
            <tbody>
              {c.payments.length === 0 && (
                <tr><td colSpan={5} className="py-4 px-4 text-muted text-[13px]">No payments recorded against this contract yet.</td></tr>
              )}
              {c.payments.map(t => (
                <tr key={t.id} className="border-b" style={{ borderColor: 'var(--cc-line)' }}>
                  <td className="py-2.5 px-4 text-muted whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td className="py-2.5 px-4 text-ink-soft">{t.category}</td>
                  <td className={`py-2.5 px-4 text-right font-mono tabular-nums ${t.amount > c.poCeiling ? 'text-[#A8483A] font-medium' : 'text-ink-soft'}`}>{fmtUSD(t.amount)}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={t.anchor === 'anchored' ? 'anchored' : 'pending'} dot>{t.anchor === 'anchored' ? 'Verified' : 'Pending'}</Badge>
                      {t.anomaly && <Badge tone={t.anomaly === 'SPIKE' || t.anomaly === 'DUPLICATE' || t.anomaly === 'OUTLIER' ? 'spike' : 'pending'} dot={false} style={{ fontSize: 10 }}>{t.anomaly}</Badge>}
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <HashChip label="sha256" value={t.sha256} chars={6} tone="anchored" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Trust footer */}
      <div className="rounded-md border p-5" style={{ borderColor: 'var(--cc-line)', background: 'var(--cc-tone-cream)' }}>
        <div className="flex items-start gap-3">
          <CheckCircle2 size={18} style={{ color: 'var(--cc-anchored)' }} className="mt-0.5 flex-shrink-0" />
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--cc-ink-soft)' }}>
            Every payment against this contract is written to a tamper-evident public ledger and anchored to a
            blockchain at close of period. The {fmtCompact(c.spent)} spent here can be independently verified, and
            the not-to-exceed ceiling is enforced against the same record.
          </p>
        </div>
      </div>
    </div>
  );
}
