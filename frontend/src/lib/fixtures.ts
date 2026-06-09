// src/lib/fixtures.ts — Mock data: Town of Millbrook, NH
// Shaped exactly to the handoff types. Drop into MSW or Storybook as fixtures.
import type { Department, Transaction, Anomaly, Heatmap } from '@/types';

export const departments: Department[] = [
  { name: 'Public Works', budget: 1_500_000, spent: 1_820_000, color: 'var(--chart-3)' },
  { name: 'Police',       budget: 1_200_000, spent: 1_080_000, color: 'var(--chart-1)' },
  { name: 'Fire & EMS',   budget:   980_000, spent:   742_000, color: 'var(--chart-2)' },
  { name: 'Parks & Rec',  budget:   900_000, spent:   421_000, color: 'var(--chart-4)' },
  { name: 'Schools',      budget: 4_200_000, spent: 2_310_000, color: 'var(--chart-5)' },
  { name: 'Admin',        budget:   620_000, spent:   388_000, color: 'var(--chart-6)' },
];

export const spendTrend = [0.82, 0.97, 1.11, 1.24, 1.38, 1.66];
export const trendMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

function hash(seed: number): string {
  const hex = '0123456789abcdef';
  let s = '';
  let x = (seed * 2_654_435_761) % 4_294_967_296;
  for (let i = 0; i < 40; i++) { x = (x * 16_807 + 17) % 4_294_967_296; s += hex[x % 16]; }
  return s;
}

const seed: [string, string, string, string, number, 'anchored'|'pending', null|string, number][] = [
  ['2026-06-01', 'Staples',           'Supplies',  'Admin',        312.40,    'anchored', null,          5943],
  ['2026-06-01', 'FuelCo Energy',     'Fuel',      'Public Works', 855.10,    'anchored', null,          5541],
  ['2026-06-02', 'Nashua Paving',     'Services',  'Public Works', 48_200.00, 'anchored', 'SPIKE',       1611],
  ['2026-06-02', 'Granite Fleet',     'Equipment', 'Fire & EMS',   12_480.00, 'anchored', null,          5511],
  ['2026-06-03', 'BoundTree Medical', 'Supplies',  'Fire & EMS',   2_240.75,  'anchored', null,          8099],
  ['2026-06-03', 'Aramark',           'Services',  'Schools',      9_620.00,  'pending',  null,          5811],
  ['2026-06-04', 'CDW-G',             'Equipment', 'Police',       6_310.20,  'anchored', null,          5045],
  ['2026-06-04', 'Northeast Salt',    'Supplies',  'Public Works', 18_900.00, 'anchored', 'DUPLICATE',   5261],
  ['2026-06-05', 'W.B. Mason',        'Supplies',  'Admin',          188.55,  'anchored', null,          5111],
  ['2026-06-05', 'Verizon',           'Utilities', 'Admin',        1_402.00,  'anchored', null,          4814],
  ['2026-06-06', 'Cintas',            'Services',  'Public Works',   740.00,  'pending',  null,          7349],
  ['2026-06-06', 'FuelCo Energy',     'Fuel',      'Police',       1_120.30,  'anchored', null,          5541],
  ['2026-06-07', 'Tyler Tech',        'Services',  'Admin',       25_000.00,  'anchored', 'OUTLIER',     7372],
  ['2026-06-07', 'Staples',           'Supplies',  'Schools',        540.10,  'anchored', null,          5943],
  ['2026-06-08', 'Granite Fleet',     'Fuel',      'Public Works',   980.00,  'anchored', null,          5541],
];

export const transactions: Transaction[] = seed.map(([date, vendor, category, department, amount, anchor, anomaly, mcc], i) => ({
  id:          `TX-${480_112 + i}`,
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
  { kind: 'Spend Spike',     vendor: 'Nashua Paving',  dept: 'Public Works', detail: '11.4× the 90-day median for Services', tone: 'spike',   tx: 'TX-480114' },
  { kind: 'Duplicate Vendor',vendor: 'Northeast Salt', dept: 'Public Works', detail: 'Identical amount + memo within 48h',    tone: 'spike',   tx: 'TX-480119' },
  { kind: 'Outlier Payment', vendor: 'Tyler Tech',     dept: 'Admin',        detail: 'Above tier ceiling for single PO',     tone: 'pending', tx: 'TX-480124' },
  { kind: 'Suspicious MCC',  vendor: 'Granite Fleet',  dept: 'Public Works', detail: 'MCC 5541 on an equipment contract',    tone: 'pending', tx: 'TX-480126' },
];

export const heatmap: Heatmap = {
  rows:   ['Public Works', 'Police', 'Fire & EMS', 'Schools', 'Admin'],
  cols:   ['W22', 'W23', 'W24', 'W25', 'W26'],
  values: [
    [1, 2, 3, 2, 3],
    [0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [0, 1, 1, 2, 1],
    [0, 0, 2, 1, 0],
  ],
};

export const totalBudget = departments.reduce((a, d) => a + d.budget, 0);
export const totalSpent  = departments.reduce((a, d) => a + d.spent,  0);
export const anchoredCount = 1_244_882;
