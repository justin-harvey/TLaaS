// src/lib/contracts.ts — shared contract scoring so the register and the detail
// page rank and flag identically. Pure functions over Contract + Transaction.
import type { Contract, ContractDetail, ContractFlag, Transaction } from '@/types';
import { fmtUSD } from './utils';

// Contract review reference date: just after the Q3 (Mar) close the rest of the
// mock reports against. Fixed so the demo is stable regardless of wall-clock.
const MOCK_TODAY    = new Date('2026-04-01T00:00:00Z');
const EXPIRING_DAYS = 60;
const STALLED_DAYS  = 75;
const NEAR_CEILING  = 0.85;

// Real-world priority: ceiling concerns first (over, then approaching), then
// expirations, then per-payment breaches, then stalled. Higher = more urgent.
const FLAG_WEIGHT: Record<ContractFlag, number> = {
  over_ceiling: 60, near_ceiling: 50, expiring: 40, po_breach: 30, stalled: 10,
};
export const FLAG_LABEL: Record<ContractFlag, string> = {
  over_ceiling: 'Over ceiling', near_ceiling: 'Near ceiling', expiring: 'Expiring soon', po_breach: 'PO breach', stalled: 'Stalled',
};
export const FLAG_TONE: Record<ContractFlag, 'spike' | 'pending' | 'info'> = {
  over_ceiling: 'spike', near_ceiling: 'pending', expiring: 'pending', po_breach: 'spike', stalled: 'info',
};

const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

export function paymentsFor(c: Contract, txns: Transaction[]): Transaction[] {
  return txns
    .filter(t => t.vendor === c.vendor && t.department === c.department)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function buildDetail(c: Contract, txns: Transaction[]): ContractDetail {
  const payments    = paymentsFor(c, txns);
  const spent       = payments.reduce((a, t) => a + t.amount, 0);
  const remaining   = c.value - spent;
  const utilizedPct = c.value ? spent / c.value : 0;
  const daysLeft    = days(MOCK_TODAY, new Date(c.endDate + 'T00:00:00Z'));
  const lastPaid    = payments[0]?.date;
  const sinceLast   = lastPaid ? days(new Date(lastPaid + 'T00:00:00Z'), MOCK_TODAY) : Infinity;
  const live        = c.status === 'Active' || c.status === 'Expiring';

  const flags: ContractFlag[] = [];
  if (utilizedPct > 1) flags.push('over_ceiling');
  else if (utilizedPct >= NEAR_CEILING) flags.push('near_ceiling');
  if (live && daysLeft >= 0 && daysLeft <= EXPIRING_DAYS) flags.push('expiring');
  if (payments.some(t => t.amount > c.poCeiling)) flags.push('po_breach');
  if (c.status === 'Active' && payments.length > 0 && sinceLast > STALLED_DAYS) flags.push('stalled');

  const severity = flags.length
    ? Math.max(...flags.map(f => FLAG_WEIGHT[f])) + 0.1 * flags.reduce((a, f) => a + FLAG_WEIGHT[f], 0)
    : 0;
  return { ...c, spent, remaining, utilizedPct, payments, flags, severity, daysLeft };
}

export function topFlag(flags: ContractFlag[]): ContractFlag | null {
  return flags.length ? [...flags].sort((a, b) => FLAG_WEIGHT[b] - FLAG_WEIGHT[a])[0] : null;
}

// Plain-language explanation for the detail page.
export function explainFlag(flag: ContractFlag, d: ContractDetail): string {
  switch (flag) {
    case 'over_ceiling':
      return `Spending of ${fmtUSD(d.spent)} has exceeded the ${fmtUSD(d.value)} not-to-exceed ceiling by ${fmtUSD(d.spent - d.value)}.`;
    case 'near_ceiling':
      return `Spending has reached ${Math.round(d.utilizedPct * 100)}% of the ${fmtUSD(d.value)} not-to-exceed ceiling.`;
    case 'expiring':
      return `The term ends in ${d.daysLeft} days (${d.endDate}). Plan a renewal or rebid now.`;
    case 'po_breach': {
      const max = d.payments.length ? Math.max(...d.payments.map(p => p.amount)) : 0;
      return `A ${fmtUSD(max)} payment exceeded the ${fmtUSD(d.poCeiling)} per-payment ceiling.`;
    }
    case 'stalled':
      return `An active contract with no payment recorded recently. Confirm delivery or close it out.`;
    default:
      return '';
  }
}
