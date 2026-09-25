// src/lib/fixtures.ts — Mock data: Town of Any Town, Maine
import type {
  Department, Transaction, Anomaly, Heatmap,
  BudgetLine, VendorSummary, DepartmentDetail, NamedValue,
  OpenCommitment, FundSummary, BudgetAmendment, Contract, AdminConsole,
} from '@/types';

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

// ------------------------------------------------------------------
// Derived analytics fixtures (Budget / Vendor / Department)
// Built from the same `departments` + `transactions` above so every page
// tells one consistent story. No new raw data, no backend required.
// ------------------------------------------------------------------

// Department budget lines: existing departments + open encumbrances + fund.
export const budgetLines: BudgetLine[] = [
  { ...departments[0], encumbered:  5_200, fund: 'General Fund'     },
  { ...departments[1], encumbered:  1_100, fund: 'General Fund'     },
  { ...departments[2], encumbered:      0, fund: 'Special Revenue'  },
  { ...departments[3], encumbered: 18_400, fund: 'Capital Projects' },
];

// Budget vs. actual monthly series, same unit and months as the overview
// spend trend ($M). Actual reuses `spendTrend`; budget is the planned line.
export const budgetTrend = {
  months: trendMonths,
  budget: [0.50, 0.75, 1.00, 1.20, 1.45, 1.70],
  actual: spendTrend,
};

// Reporting period: FY2026 runs Jul 2025 to Jun 2026; books are closed
// through Mar 2026 (Q3), so 9 of 12 months (0.75) of the year have elapsed.
// Burn-rate and pacing math annualize spend-to-date against this fraction.
export const reportingAsOf = 'Mar 2026';
export const fyElapsedPct  = 0.75;

// Spend grouped by assigned category (for donuts).
export const categorySpend: NamedValue[] = (() => {
  const m = new Map<string, number>();
  for (const t of transactions) m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
})();

// Deterministic payment-mechanism assignment per vendor (RePay-style rails).
const MECHANISMS = ['VirtualCard', 'ACH', 'EFT', 'Check'] as const;
function mechanismFor(vendor: string): string {
  let h = 0;
  for (const c of vendor) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return MECHANISMS[h % MECHANISMS.length];
}

// One row per vendor, aggregated from the transaction cache.
export const vendorSummaries: VendorSummary[] = (() => {
  const m = new Map<string, VendorSummary>();
  for (const t of transactions) {
    const cur = m.get(t.vendor);
    if (!cur) {
      m.set(t.vendor, {
        vendor:    t.vendor,
        category:  t.category,
        mechanism: mechanismFor(t.vendor),
        txns:      1,
        total:     t.amount,
        lastPaid:  t.date,
        anomalies: t.anomaly ? 1 : 0,
        anchor:    t.anchor,
      });
    } else {
      cur.txns      += 1;
      cur.total     += t.amount;
      cur.anomalies += t.anomaly ? 1 : 0;
      if (t.date > cur.lastPaid) cur.lastPaid = t.date;
      if (t.anchor === 'pending') cur.anchor = 'pending';
    }
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
})();

// Vendor spend split by payment mechanism (for the mechanism donut).
export const mechanismMix: NamedValue[] = (() => {
  const m = new Map<string, number>();
  for (const v of vendorSummaries) m.set(v.mechanism, (m.get(v.mechanism) ?? 0) + v.total);
  return [...m.entries()].map(([name, value]) => ({ name, value }));
})();

// Top vendors by total spend (for the ranked bar chart).
export const topVendors: NamedValue[] = vendorSummaries
  .slice(0, 6)
  .map(v => ({ name: v.vendor, value: v.total }));

// Per-department rollup: budget line + transaction counts + top vendor.
export const departmentDetails: DepartmentDetail[] = budgetLines.map(line => {
  const txns = transactions.filter(t => t.department === line.name);
  const byVendor = new Map<string, number>();
  for (const t of txns) byVendor.set(t.vendor, (byVendor.get(t.vendor) ?? 0) + t.amount);
  const topVendor = [...byVendor.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'None';
  return {
    ...line,
    txns:      txns.length,
    anomalies: txns.filter(t => t.anomaly != null).length,
    topVendor,
  };
});

// Spend by department (for the share chart).
export const deptSpend: NamedValue[] = budgetLines.map(l => ({ name: l.name, value: l.spent }));

// ------------------------------------------------------------------
// Multi-year budget history (mock) for the fiscal-year selector and
// year-over-year comparison. FY2026 mirrors the live budgetLines so the
// rest of the page stays consistent. Prior-year figures are YTD through the
// same Q3 close point each year, so YoY compares like for like.
// ------------------------------------------------------------------
const FY_LINES: Record<string, BudgetLine[]> = {
  FY2026: budgetLines,
  FY2025: [
    { name: 'Snow & Ice Removal',     budget:  46_000, spent: 33_800, encumbered:  3_900, fund: 'General Fund',     color: 'var(--chart-1)' },
    { name: 'Public Works & Parks',   budget:  30_000, spent: 24_100, encumbered:  1_300, fund: 'General Fund',     color: 'var(--chart-2)' },
    { name: 'Pavement Crack Sealing', budget:  18_500, spent: 19_500, encumbered:      0, fund: 'Special Revenue',  color: 'var(--chart-5)' },
    { name: 'Dock Bulkhead Repairs',  budget: 120_000, spent: 81_200, encumbered: 12_400, fund: 'Capital Projects', color: 'var(--cc-anchored)' },
  ],
};

const FY_PRIOR_YTD: Record<string, Record<string, number>> = {
  FY2026: { 'Snow & Ice Removal': 33_800, 'Public Works & Parks': 24_100, 'Pavement Crack Sealing': 19_500, 'Dock Bulkhead Repairs': 81_200 },
  FY2025: { 'Snow & Ice Removal': 31_500, 'Public Works & Parks': 22_400, 'Pavement Crack Sealing': 17_800, 'Dock Bulkhead Repairs': 74_600 },
};

const FY_CATEGORY: Record<string, NamedValue[]> = {
  FY2026: categorySpend,
  FY2025: [
    { name: 'Services',  value: 58_140 },
    { name: 'Equipment', value: 30_900 },
    { name: 'Supplies',  value: 11_400 },
    { name: 'Fuel',      value:  6_700 },
  ],
};

const FY_TREND: Record<string, { months: string[]; budget: number[]; actual: number[] }> = {
  FY2026: budgetTrend,
  FY2025: { months: trendMonths, budget: [0.45, 0.70, 0.95, 1.15, 1.40, 1.60], actual: [0.40, 0.63, 0.85, 1.02, 1.22, 1.38] },
};

const FY_META: Record<string, { asOf: string; fyElapsedPct: number }> = {
  FY2026: { asOf: reportingAsOf, fyElapsedPct },
  FY2025: { asOf: 'Mar 2025', fyElapsedPct: 0.75 },
};

// Open purchase orders behind each year's encumbered figure. Per-department
// amounts sum to that department's `encumbered` in FY_LINES.
const FY_COMMITMENTS: Record<string, OpenCommitment[]> = {
  FY2026: [
    { id: 'PO-2026-0120', vendor: 'Casco Marine Supply',        department: 'Dock Bulkhead Repairs', amount: 12_400, issued: '2026-01-22', status: 'Open' },
    { id: 'PO-2026-0133', vendor: 'Casco Marine Works',         department: 'Dock Bulkhead Repairs', amount:  6_000, issued: '2026-02-10', status: 'Partially Received' },
    { id: 'PO-2026-0142', vendor: 'NAPA Auto Parts',            department: 'Snow & Ice Removal',    amount:  3_200, issued: '2026-02-18', status: 'Open' },
    { id: 'PO-2026-0151', vendor: 'Any Town Equipment Rental',  department: 'Snow & Ice Removal',    amount:  2_000, issued: '2026-03-02', status: 'Partially Received' },
    { id: 'PO-2026-0149', vendor: 'Mitchell Field Nursery',     department: 'Public Works & Parks',  amount:  1_100, issued: '2026-03-05', status: 'Open' },
  ],
  FY2025: [
    { id: 'PO-2025-0198', vendor: 'Casco Marine Supply',        department: 'Dock Bulkhead Repairs', amount: 12_400, issued: '2025-01-20', status: 'Open' },
    { id: 'PO-2025-0212', vendor: 'NAPA Auto Parts',            department: 'Snow & Ice Removal',    amount:  3_900, issued: '2025-02-15', status: 'Open' },
    { id: 'PO-2025-0220', vendor: 'Mitchell Field Nursery',     department: 'Public Works & Parks',  amount:  1_300, issued: '2025-03-01', status: 'Open' },
  ],
};

// Per-fund revenue, expenditure, and balances. Expenditure reconciles to the
// sum of each fund's department spend; endingBalance = beginning + rev - exp.
const FY_FUNDS: Record<string, FundSummary[]> = {
  FY2026: [
    { fund: 'General Fund',     revenue: 78_500, expenditure: 65_303, beginningBalance: 142_000, endingBalance: 155_197 },
    { fund: 'Special Revenue',  revenue: 19_800, expenditure: 17_200, beginningBalance:  24_500, endingBalance:  27_100 },
    { fund: 'Capital Projects', revenue: 95_000, expenditure: 87_806, beginningBalance: 210_000, endingBalance: 217_194 },
  ],
  FY2025: [
    { fund: 'General Fund',     revenue: 71_000, expenditure: 57_900, beginningBalance: 138_000, endingBalance: 151_100 },
    { fund: 'Special Revenue',  revenue: 18_500, expenditure: 19_500, beginningBalance:  25_000, endingBalance:  24_000 },
    { fund: 'Capital Projects', revenue: 88_000, expenditure: 81_200, beginningBalance: 195_000, endingBalance: 201_800 },
  ],
};

// Mid-year appropriation changes (council-approved amendments and transfers).
const FY_AMENDMENTS: Record<string, BudgetAmendment[]> = {
  FY2026: [
    { id: 'AMD-2026-04', date: '2026-02-24', department: 'Dock Bulkhead Repairs',  fund: 'Capital Projects', type: 'Increase', delta:  15_000, reason: 'Storm damage to north bulkhead', status: 'Approved' },
    { id: 'AMD-2026-03', date: '2026-02-03', department: 'Snow & Ice Removal',     fund: 'General Fund',     type: 'Transfer', delta:   6_000, reason: 'Transfer from contingency for road salt', status: 'Approved' },
    { id: 'AMD-2026-02', date: '2026-01-20', department: 'Public Works & Parks',   fund: 'General Fund',     type: 'Decrease', delta:  -2_500, reason: 'Deferred playground resurfacing', status: 'Approved' },
    { id: 'AMD-2026-05', date: '2026-03-11', department: 'Pavement Crack Sealing', fund: 'Special Revenue',  type: 'Increase', delta:   3_000, reason: 'Grant match for crack-seal program', status: 'Pending' },
  ],
  FY2025: [
    { id: 'AMD-2025-06', date: '2025-02-18', department: 'Dock Bulkhead Repairs', fund: 'Capital Projects', type: 'Increase', delta: 10_000, reason: 'Engineering re-scope', status: 'Approved' },
    { id: 'AMD-2025-04', date: '2025-01-15', department: 'Snow & Ice Removal',    fund: 'General Fund',     type: 'Transfer', delta:  4_500, reason: 'Transfer from contingency', status: 'Approved' },
  ],
};

export const fiscalYears = ['FY2026', 'FY2025'];

export function budgetForYear(year: string) {
  const y = FY_LINES[year] ? year : fiscalYears[0];
  return {
    lines:       FY_LINES[y],
    byCategory:  FY_CATEGORY[y],
    trend:       FY_TREND[y],
    period:      FY_META[y],
    prior:       FY_PRIOR_YTD[y] ?? {},
    commitments: FY_COMMITMENTS[y] ?? [],
    funds:       FY_FUNDS[y] ?? [],
    amendments:  FY_AMENDMENTS[y] ?? [],
  };
}

// ------------------------------------------------------------------
// Contracts (mock): the real procurement objects. Each maps to a vendor +
// department so its payment trail populates from the `transactions` above.
// Flags are seeded by the existing anomalies (Coastal SPIKE = over ceiling +
// PO breach; Casco Marine Works OUTLIER = PO breach), plus expiring + stalled.
// ------------------------------------------------------------------
export const contracts: Contract[] = [
  { id: 'CON-2026-014', title: 'Pavement Crack Sealing Program', vendor: 'Coastal Road Services LLC',        department: 'Pavement Crack Sealing', fund: 'Special Revenue',  type: 'Construction', value:  18_000, poCeiling: 10_000, startDate: '2025-10-01', endDate: '2026-09-30', status: 'Active',   awardDate: '2025-09-15' },
  { id: 'CON-2026-008', title: 'North Bulkhead Reconstruction',  vendor: 'Casco Marine Works',               department: 'Dock Bulkhead Repairs',  fund: 'Capital Projects', type: 'Construction', value: 135_000, poCeiling: 20_000, startDate: '2026-01-01', endDate: '2026-12-31', status: 'Active',   awardDate: '2025-12-10' },
  { id: 'CON-2025-031', title: 'Seasonal Snow Plowing',          vendor: 'Morrison Landscaping & Plowing LLC', department: 'Snow & Ice Removal',   fund: 'General Fund',     type: 'Services',     value:  48_000, poCeiling:  6_000, startDate: '2025-11-01', endDate: '2026-05-31', status: 'Expiring', awardDate: '2025-10-20' },
  { id: 'CON-2025-012', title: 'Auto Parts Supply',             vendor: 'NAPA Auto Parts',                  department: 'Snow & Ice Removal',     fund: 'General Fund',     type: 'Goods',        value:   8_000, poCeiling:  1_500, startDate: '2025-07-01', endDate: '2026-05-15', status: 'Expiring', awardDate: '2025-06-25' },
  { id: 'CON-2026-003', title: 'Heavy Equipment Rental',        vendor: 'Any Town Equipment Rental',        department: 'Snow & Ice Removal',     fund: 'General Fund',     type: 'Goods',        value:   7_000, poCeiling:  3_500, startDate: '2025-12-01', endDate: '2026-11-30', status: 'Active',   awardDate: '2025-11-15' },
  { id: 'CON-2025-022', title: 'Grounds & Parks Maintenance',   vendor: 'GreenWorks Maine LLC',             department: 'Public Works & Parks',   fund: 'General Fund',     type: 'Services',     value:  31_000, poCeiling: 20_000, startDate: '2025-07-01', endDate: '2026-12-31', status: 'Active',   awardDate: '2025-06-15' },
  { id: 'CON-2025-040', title: 'Fleet Fuel Supply',             vendor: 'Irving Oil, Bath ME',              department: 'Snow & Ice Removal',     fund: 'General Fund',     type: 'Goods',        value:  15_000, poCeiling:  2_000, startDate: '2025-07-01', endDate: '2027-06-30', status: 'Active',   awardDate: '2025-06-20' },
  { id: 'CON-2026-009', title: 'Marine Materials Supply',       vendor: 'Casco Marine Supply',              department: 'Dock Bulkhead Repairs',  fund: 'Capital Projects', type: 'Goods',        value:  25_000, poCeiling:  5_000, startDate: '2026-01-01', endDate: '2026-12-31', status: 'Active',   awardDate: '2025-12-10' },
  { id: 'CON-2025-035', title: 'Sealant Materials',             vendor: 'Maine Pavement Supply Co.',        department: 'Pavement Crack Sealing', fund: 'Special Revenue',  type: 'Goods',        value:  12_000, poCeiling:  5_000, startDate: '2025-10-01', endDate: '2026-09-30', status: 'Active',   awardDate: '2025-09-20' },
  { id: 'CON-2026-017', title: 'Spring Plantings',              vendor: 'Mitchell Field Nursery',           department: 'Public Works & Parks',   fund: 'General Fund',     type: 'Goods',        value:   5_000, poCeiling:  2_000, startDate: '2026-03-01', endDate: '2026-10-31', status: 'Active',   awardDate: '2026-02-15' },
];

// ------------------------------------------------------------------
// Administration (mock): the tenant admin console. Governance reuses the
// real lib/governance shapes (close-of-period, override audit); the rest is
// mock account/access data grounded in the security docs and the validator feeds.
// ------------------------------------------------------------------
export const adminConsole: AdminConsole = {
  tenant: {
    name:            'Town of Any Town, Maine',
    tier:            'Community',
    population:      'Under 25,000 residents',
    fiscalYearStart: 'July 1',
    funds:           ['General Fund', 'Special Revenue', 'Capital Projects'],
    retentionMonths: 84,
    adminWallets: [
      'GDFIN4XKQV5XJN3RP4M6YD8WZC9FB2HT5LKQ3RX7VN4MJ8PD6SAW2YHC',
      'GCLERK7KQV5XJN3RP4M6YD8WZC9FB2HT5LKQ3RX7VN4MJ8PD6SAW2YH9',
    ],
  },
  users: [
    { id: 'U-01', name: 'Dana Whitfield',  email: 'dwhitfield@anytown.me.gov', role: 'Administrator', status: 'Active',  lastLogin: '2026-03-28', wallet: 'GDFIN4XKQV5XJN3RP4M6YD8WZC9FB2HT5LKQ3RX7VN4MJ8PD6SAW2YHC' },
    { id: 'U-02', name: 'Frank Reyes',     email: 'freyes@anytown.me.gov',     role: 'Administrator', status: 'Active',  lastLogin: '2026-03-22', wallet: 'GCLERK7KQV5XJN3RP4M6YD8WZC9FB2HT5LKQ3RX7VN4MJ8PD6SAW2YH9' },
    { id: 'U-03', name: 'Marcus Bell',     email: 'mbell@anytown.me.gov',      role: 'Finance',       status: 'Active',  lastLogin: '2026-03-27' },
    { id: 'U-04', name: 'Priya Sundaram',  email: 'psundaram@anytown.me.gov',  role: 'Finance',       status: 'Active',  lastLogin: '2026-03-25' },
    { id: 'U-05', name: 'Town Council',    email: 'council@anytown.me.gov',    role: 'Viewer',        status: 'Active',  lastLogin: '2026-03-19' },
    { id: 'U-06', name: 'R. Okafor (External Auditor)', email: 'rokafor@audit-partners.com', role: 'Viewer', status: 'Invited', lastLogin: '' },
  ],
  connections: [
    { id: 'C-01', name: 'Plaid',       kind: 'Bank feed',      status: 'Connected', lastSync: '2026-03-31 06:02', recordsToday: 9 },
    { id: 'C-02', name: 'RePay',       kind: 'Card processor', status: 'Connected', lastSync: '2026-03-31 06:05', recordsToday: 6 },
    { id: 'C-03', name: 'Tyler Munis', kind: 'ERP',            status: 'Error',     lastSync: '2026-03-29 06:00', recordsToday: 0, note: 'SFTP credentials expired. Reauthorize to resume sync.' },
  ],
  closedPeriods: [
    { monthKey: '2026-02', closedAt: '2026-03-05', closedBy: 'Dana Whitfield', records: 41, stellarTx: '8F2C9A1D7E4B6058C3A2F1' },
    { monthKey: '2026-01', closedAt: '2026-02-04', closedBy: 'Dana Whitfield', records: 38, stellarTx: '3B7E1F9C2A6D40583E1B7C' },
    { monthKey: '2025-12', closedAt: '2026-01-06', closedBy: 'Frank Reyes',    records: 52, stellarTx: 'C1A4D8B2F6E390571D4A2B' },
    { monthKey: '2025-11', closedAt: '2025-12-04', closedBy: 'Dana Whitfield', records: 47, stellarTx: '9E3F7A0C5B1D24686F2C3A' },
  ],
  openMonth: '2026-03',
  audit: [
    { id: 'A-01', vendor: 'Route 1 Diner',             previousCategory: 'Services',  newCategory: 'Office Administration',       admin: 'Dana Whitfield', justification: 'MCC 5812 flagged; reclassified staff working-lunch to administration.', signedAt: '2026-03-14', tx: 'A7F2C19D4E8B6053F1A2C7' },
    { id: 'A-02', vendor: 'Irving Oil, Bath ME',       previousCategory: 'Fuel',      newCategory: 'General Operating Costs',     admin: 'Marcus Bell',    justification: 'Bulk diesel for generators, not fleet fuel.',                          signedAt: '2026-03-11', tx: '2D9E1F7A4C6B30582E1B9C' },
    { id: 'A-03', vendor: 'NAPA Auto Parts',           previousCategory: 'Equipment', newCategory: 'Shop Tools & Battery Supplies', admin: 'Priya Sundaram', justification: 'Hand tools and batteries, not capital equipment.',                    signedAt: '2026-03-09', tx: 'F1B7C29D5E3A40681D2C4B' },
    { id: 'A-04', vendor: 'Coastal Road Services LLC', previousCategory: 'Services',  newCategory: 'Facilities Overhead',          admin: 'Dana Whitfield', justification: 'Allocated to facilities per public works director.',                    signedAt: '2026-03-06', tx: '7C3A1F9D2E5B40583F1A2D' },
    { id: 'A-05', vendor: 'Mitchell Field Nursery',    previousCategory: 'Supplies',  newCategory: 'Facilities Overhead',          admin: 'Frank Reyes',    justification: 'Grounds plantings reclassified to facilities.',                        signedAt: '2026-03-02', tx: '4E8B2C1F7A9D30586E1B3C' },
    { id: 'A-06', vendor: 'Casco Marine Supply',       previousCategory: 'Equipment', newCategory: 'Shipping Logistics',           admin: 'Marcus Bell',    justification: 'Freight and delivery line items split out.',                           signedAt: '2026-02-24', tx: 'B6D1F3A9C2E740582B1A7C' },
    { id: 'A-07', vendor: 'GreenWorks Maine LLC',      previousCategory: 'Services',  newCategory: 'Facilities Overhead',          admin: 'Dana Whitfield', justification: 'Seasonal grounds maintenance to facilities.',                          signedAt: '2026-02-19', tx: '1A9C7F2D4E6B30589C1B2A' },
    { id: 'A-08', vendor: 'Any Town Equipment Rental', previousCategory: 'Equipment', newCategory: 'Shop Tools & Battery Supplies', admin: 'Priya Sundaram', justification: 'Short-term rental reclassified per finance review.',                   signedAt: '2026-02-13', tx: 'E3F1A7C9D2B540586F1A2C' },
  ],
  ruleset: [
    { mcc: 5541, mccDesc: 'Service Stations',                  category: 'Fuel' },
    { mcc: 5533, mccDesc: 'Automotive Parts & Accessories',    category: 'Equipment' },
    { mcc: 5812, mccDesc: 'Eating Places & Restaurants',       category: 'Services' },
    { mcc: 7359, mccDesc: 'Equipment & Tool Rental',           category: 'Equipment' },
    { mcc: 5065, mccDesc: 'Electrical Parts & Equipment',      category: 'Equipment' },
    { mcc: 5261, mccDesc: 'Nurseries & Garden Supply',         category: 'Supplies' },
    { mcc:  780, mccDesc: 'Landscaping & Horticultural Svcs',  category: 'Services' },
    { mcc: 1711, mccDesc: 'Heating, Plumbing & A/C',           category: 'Services' },
    { mcc: 5251, mccDesc: 'Hardware Stores',                   category: 'Supplies' },
    { mcc: 1520, mccDesc: 'General Contractors',               category: 'Services' },
    { mcc: 5039, mccDesc: 'Construction Materials',            category: 'Supplies' },
    { mcc: 4900, mccDesc: 'Utilities (Electric, Gas, Water)',  category: 'Utilities' },
  ],
};
