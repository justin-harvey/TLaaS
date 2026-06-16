'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { BudgetBar, Button } from '@/components/cc';
import { getBudgetAnalytics } from '@/lib/api';
import { fmtCompact, fmtUSD } from '@/lib/utils';
import { PublicCheckbook } from './checkbook';
import type { BudgetAnalyticsResponse } from '@/types';

export default function PublicBudgetPage() {
  const [data, setData] = useState<BudgetAnalyticsResponse | null>(null);
  useEffect(() => { getBudgetAnalytics().then(setData); }, []);

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cc-paper)' }}>
      <p className="type-label animate-pulse">Loading…</p>
    </div>
  );

  const approved  = data.lines.reduce((a, l) => a + l.budget, 0);
  const actual    = data.lines.reduce((a, l) => a + l.spent, 0);
  const committed = data.lines.reduce((a, l) => a + l.encumbered, 0);
  const remaining = approved - actual - committed;  // reconciles with the admin Remaining Balance
  const utilized  = Math.round((actual / approved) * 100);
  const top       = [...data.lines].sort((a, b) => b.spent - a.spent);
  const bigNums: [string, number][] = [['Budgeted', approved], ['Spent so far', actual], ['Remaining', remaining]];

  return (
    <div className="min-h-screen" style={{ background: 'var(--cc-paper)' }}>
      {/* Public top bar */}
      <header className="border-b" style={{ borderColor: 'var(--cc-line)', background: 'var(--cc-card)' }}>
        <div className="max-w-[900px] mx-auto flex items-center justify-between px-6 h-[60px]">
          <div className="flex items-center gap-2.5">
            <Image src="/brand/civic-chain-logo.svg" alt="Civic-Chain" width={26} height={26} />
            <div>
              <p className="font-display text-[15px] leading-none" style={{ color: 'var(--cc-ink)' }}>Town of Any Town, Maine</p>
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase mt-0.5" style={{ color: 'var(--cc-muted)' }}>Public Budget</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-md"
            style={{ background: 'var(--cc-tone-sage)', color: 'var(--cc-tone-sage-fg)' }}>
            <Shield size={13} /> Verified on a public ledger
          </span>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-6 py-10 space-y-10">
        {/* Plain-language summary */}
        <section>
          <p className="type-label mb-2">Fiscal Year {data.year.replace('FY', '')} · figures as of {data.period.asOf}</p>
          <h1 className="type-display mb-4">Where our money goes</h1>
          <p className="text-[18px] leading-relaxed" style={{ color: 'var(--cc-ink-soft)' }}>
            This year the town set aside <b>{fmtUSD(approved)}</b> to run services and projects.
            So far we have spent <b>{fmtUSD(actual)}</b> ({utilized}% of the plan) and committed another
            {' '}<b>{fmtUSD(committed)}</b> to open orders, leaving <b>{fmtUSD(remaining)}</b> still to spend.
          </p>
        </section>

        {/* Big numbers */}
        <section className="grid grid-cols-3 gap-4">
          {bigNums.map(([label, value]) => (
            <div key={label} className="rounded-md border p-5" style={{ borderColor: 'var(--cc-line)', background: 'var(--cc-card-raised)' }}>
              <p className="type-label mb-2">{label}</p>
              <p className="font-mono text-[26px] tabular-nums" style={{ color: 'var(--cc-ink)' }}>{fmtCompact(value)}</p>
            </div>
          ))}
        </section>

        {/* By department, in plain terms */}
        <section>
          <h2 className="type-h2 mb-4">By department</h2>
          <div className="space-y-5 rounded-md border p-6" style={{ borderColor: 'var(--cc-line)', background: 'var(--cc-card)' }}>
            {top.map(l => (
              <div key={l.name}>
                <BudgetBar label={l.name} spent={l.spent} budget={l.budget} color={l.color} />
                <p className="text-[12px] mt-1" style={{ color: 'var(--cc-muted)' }}>
                  {Math.round((l.spent / l.budget) * 100)}% of its {fmtUSD(l.budget)} budget used so far
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Public open checkbook */}
        <PublicCheckbook />

        {/* Trust / verification */}
        <section className="rounded-md border p-6" style={{ borderColor: 'var(--cc-line)', background: 'var(--cc-tone-cream)' }}>
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} style={{ color: 'var(--cc-anchored)' }} className="mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="type-h3 mb-1">Every dollar is on the record</h2>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--cc-ink-soft)' }}>
                Each payment the town makes is written to a tamper-evident public ledger and anchored to a blockchain,
                so anyone can confirm the figures on this page have not been changed after the fact.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant="primary" size="sm" href="/ledger" iconRight icon={<ArrowRight size={13} />}>Explore the public ledger</Button>
                <Button variant="secondary" size="sm" href="/verify">Verify a record</Button>
              </div>
            </div>
          </div>
        </section>

        <footer className="pt-6 border-t text-[12px]" style={{ borderColor: 'var(--cc-line)', color: 'var(--cc-muted)' }}>
          Published by the Town of Any Town, Maine · Figures as of {data.period.asOf} · Powered by Civic-Chain
        </footer>
      </main>
    </div>
  );
}
