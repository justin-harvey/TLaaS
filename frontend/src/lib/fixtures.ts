// src/lib/fixtures.ts — Mock data: Town of Any Town, Maine
import type { Department, Transaction, Anomaly, Heatmap } from '@/types';

// 4 active contracts mapped as budget departments
export const departments: Department[] = [
  { name: 'Snow & Ice Removal',     budget:  48_000, spent:  36_153, color: 'var(--chart-1)' },
  { name: 'Public Works & Parks',   budget:  31_000, spent:  29_150, color: 'var(--chart-2)' },
  { name: 'Pavement Crack Sealing', budget:  17_200, spent:  17_200, color: 'var(--chart-5)' },
  { name: 'Dock Bulkhead Repairs',  budget: 134_700, spent:  87_806, color: 'var(--cc-anchored)' },
];

export const spendTrend = [0.42, 0.68, 0.91, 1.10, 1.31, 1.47];
export const trendMonths = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

function hash(seed: number): string {
  const hex = '0123456789abcdef';
  let s = '';
  let x = (seed * 2_654_435_761) % 4_294_967_296;
  for (let i = 0; i < 40; i++) { x = (x * 16_807 + 17) % 4_294_967_296; s += hex[x % 16]; }
  return s;
}

const seed: [string, string, string, string, number, 'anchored'|'pending', null|string, number][] = [
  ['2026-03-13', 'NAPA Auto Parts',            'Equipment', 'Snow & Ice Removal',       127.50, 'anchored', null,             5533],
  ['2026-03-13', 'Irving Oil, Bath ME',         'Fuel',      'Snow & Ice Removal',        87.20, 'anchored', null,             5541],
  ['2026-03-13', 'Route 1 Diner',               'Services',  'Snow & Ice Removal',        43.90, 'anchored', 'SUSPICIOUS_MCC', 5812],
  ['2026-03-12', 'Any Town Equipment Rental',   'Equipment', 'Snow & Ice Removal',     3_200.00, 'anchored', null,             7359],
  ['2026-03-12', 'Casco Marine Supply',         'Equipment', 'Dock Bulkhead Repairs',  1_430.00, 'anchored', null,             5065],
  ['2026-03-12', 'Mitchell Field Nursery',      'Supplies',  'Public Works & Parks',     850.00, 'pending',  null,             5261],
  ['2026-03-10', 'Casco Marine Supply',         'Equipment', 'Dock Bulkhead Repairs',  2_118.00, 'anchored', null,             5065],
  ['2026-03-07', 'Morrison Landscaping & Plowing LLC', 'Services', 'Snow & Ice Removal', 4_600.00, 'anchored', null,          780],
  ['2026-03-04', 'Coastal Road Services LLC',   'Services',  'Pavement Crack Sealing', 5_167.30, 'anchored', 'SPIKE',          1711],
  ['2026-03-04', 'Maine Pavement Supply Co.',   'Supplies',  'Pavement Crack Sealing', 3_440.00, 'anchored', null,             5251],
  ['2026-03-03', 'Irving Oil, Bath ME',         'Fuel',      'Snow & Ice Removal',       847.20, 'anchored', 'DUPLICATE',      5541],
  ['2026-03-03', 'Any Town Equipment Rental',   'Equipment', 'Snow & Ice Removal',     3_200.00, 'anchored', 'DUPLICATE',      7359],
  ['2026-03-01', 'Coastal Road Services LLC',   'Services',  'Pavement Crack Sealing',13_760.00, 'anchored', null,             1711],
  ['2026-01-15', 'GreenWorks Maine LLC',        'Services',  'Public Works & Parks',  18_000.00, 'anchored', null,              780],
  ['2026-01-09', 'Casco Marine Works',          'Services',  'Dock Bulkhead Repairs', 22_071.00, 'anchored', 'OUTLIER',        1520],
];

export const transactions: Transaction[] = seed.map(([date, vendor, category, department, amount, anchor, anomaly, mcc], i) => ({
  id:          `TX-${480_100 + i}`,
  date, vendor, category, department, amount,
  anchor:      anchor as 'anchored' | 'pending',
  anomaly:     anomaly as null | 'SPIKE' | 'DUPLICATE' | 'OUTLIER' | 'SUSPICIOUS_MCC',
  mcc,
  sha256:      hash(i + 7),
  ledgerTx:    hash(i + 99).slice(0, 18).toUpperCase(),
  fingerprint: hash(i + 41).slice(0, 24),
  block:       1_244_870 + i * 3,
  ts:          `${date}T14:${String(10 + i).padStart(2, '0')}:08Z`,
}));

export const anomalies: Anomaly[] = [
  { kind: 'Spend Spike',      vendor: 'Coastal Road Services LLC', dept: 'Pavement Crack Sealing', detail: '8.2× the 90-day median for Services',    tone: 'spike',   tx: 'TX-480108' },
  { kind: 'Duplicate Vendor', vendor: 'Irving Oil, Bath ME',       dept: 'Snow & Ice Removal',     detail: 'Identical amount + memo within 48h',     tone: 'spike',   tx: 'TX-480110' },
  { kind: 'Duplicate Vendor', vendor: 'Any Town Equipment Rental', dept: 'Snow & Ice Removal',     detail: 'Same PO amount on consecutive days',     tone: 'spike',   tx: 'TX-480111' },
  { kind: 'Outlier Payment',  vendor: 'Casco Marine Works',        dept: 'Dock Bulkhead Repairs',  detail: 'Above single-PO ceiling for contract',   tone: 'pending', tx: 'TX-480114' },
  { kind: 'Suspicious MCC',   vendor: 'Route 1 Diner',             dept: 'Snow & Ice Removal',     detail: 'MCC 5812 (restaurant) on fleet contract', tone: 'pending', tx: 'TX-480102' },
];

export const heatmap: Heatmap = {
  rows:   ['Snow & Ice Removal', 'Public Works & Parks', 'Pavement Sealing', 'Dock Repairs'],
  cols:   ['W8', 'W9', 'W10', 'W11', 'W12'],
  values: [
    [1, 2, 3, 2, 2],
    [0, 1, 1, 2, 1],
    [2, 3, 1, 0, 0],
    [0, 1, 2, 1, 1],
  ],
};

export const totalBudget    = departments.reduce((a, d) => a + d.budget, 0);
export const totalSpent     = departments.reduce((a, d) => a + d.spent,  0);
export const anchoredCount  = 1_244_882;

// MTA account headline figures
export const mtaBalance     = 487_250;
export const mtaAllocated   = 230_900;
export const mtaUnallocated = 256_350;
export const cardPoolTotal  =  59_031;
