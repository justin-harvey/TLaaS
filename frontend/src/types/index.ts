// src/types/index.ts — TLaaS / Civic-Chain data types (from handoff README)

export type AnchorStatus  = 'anchored' | 'pending';
export type AnomalyStatus = null | 'SPIKE' | 'DUPLICATE' | 'OUTLIER' | 'SUSPICIOUS_MCC';

export interface Department {
  name:   string;
  budget: number;
  spent:  number;
  color?: string;
}

export interface Transaction {
  id:          string;
  date:        string;        // 'YYYY-MM-DD'
  vendor:      string;
  category:    string;
  department:  string;
  amount:      number;
  mcc:         number;
  anchor:      AnchorStatus;
  anomaly:     AnomalyStatus;
  sha256:      string;
  fingerprint: string;
  ledgerTx:    string;
  block:       number;
  ts:          string;        // ISO 8601 Z
}

export interface Anomaly {
  kind:   string;
  vendor: string;
  dept:   string;
  detail: string;
  tone:   'spike' | 'pending';
  tx:     string;             // TX id
}

export interface Heatmap {
  rows:   string[];
  cols:   string[];
  values: number[][];
}

// API response shapes
export interface OverviewResponse {
  kpis: {
    mtaBalance:     number;
    allocated:      number;
    unallocated:    number;
    cardPoolTotal:  number;
  };
  trend: {
    months: string[];
    values: number[];
  };
  departments:    Department[];
  recentAnchors:  Transaction[];
  recentAnomalies: Anomaly[];
}

export interface TransactionListResponse {
  rows:        Transaction[];
  nextCursor?: string;
  total:       number;
}

export interface VerifyResponse {
  cacheHash:   string;
  ledgerHash:  string;
  match:       boolean;
  ledgerTx:    string;
  block:       number;
  timestamp:   string;
}

export interface QueryNLResponse {
  sql:         string;
  modelNotes?: string;
}

export interface QuerySQLResponse {
  columns:  string[];
  rows:     unknown[][];
  meta: {
    rowCount:              number;
    ms:                    number;
    servedFromCache:       boolean;
    fingerprintVerified:   boolean;
  };
}

export interface AnomaliesResponse {
  items:   Anomaly[];
  heatmap: Heatmap;
}

// Transaction filter params
export interface TxFilter {
  dept?:    string;
  vendor?:  string;
  from?:    string;
  to?:      string;
  minAmt?:  number;
  maxAmt?:  number;
  mcc?:     number;
  anchor?:  AnchorStatus;
  anomaly?: AnomalyStatus;
  cursor?:  string;
}

// Page identifiers for sidebar nav
export type PageId =
  | 'overview' | 'ledger' | 'query' | 'verify' | 'anomalies'
  | 'budget' | 'vendors' | 'dept' | 'contracts' | 'admin';

// ------------------------------------------------------------------
// Analytics surfaces (Budget / Vendor / Department): mock-first, same
// fallback contract as the existing pages (see lib/api.ts useMock).
// ------------------------------------------------------------------

// Municipal fund the appropriation lives in.
export type Fund = 'General Fund' | 'Special Revenue' | 'Capital Projects';

// A department budget line: a Department plus open encumbrances and its fund.
export interface BudgetLine extends Department {
  encumbered: number;   // open POs not yet paid
  fund:       Fund;
}

export interface NamedValue {
  name:  string;
  value: number;
}

// ---- Budget Analytics ----------------------------------------------------
export interface BudgetAnalyticsResponse {
  year:       string;        // active fiscal year, e.g. 'FY2026'
  years:      string[];      // selectable fiscal years
  kpis: {
    approved:    number;
    actual:      number;
    encumbered:  number;
    remaining:   number;
    utilizedPct: number;
  };
  // Reporting period context, used for burn-rate / pacing math.
  period:     { asOf: string; fyElapsedPct: number };
  trend:      { months: string[]; budget: number[]; actual: number[] };
  lines:      BudgetLine[];
  byCategory:  NamedValue[];
  prior:       Record<string, number>;  // prior-year YTD spend keyed by department
  commitments: OpenCommitment[];
  funds:       FundSummary[];
  amendments:  BudgetAmendment[];
}

// A mid-year appropriation change (increase, decrease, or transfer between lines).
export interface BudgetAmendment {
  id:         string;        // 'AMD-2026-04'
  date:       string;        // 'YYYY-MM-DD'
  department: string;
  fund:       Fund;
  type:       'Increase' | 'Decrease' | 'Transfer';
  delta:      number;        // signed change to the appropriation
  reason:     string;
  status:     'Approved' | 'Pending';
}

// Open purchase orders behind the encumbered figure.
export interface OpenCommitment {
  id:         string;
  vendor:     string;
  department: string;
  amount:     number;
  issued:     string;        // 'YYYY-MM-DD'
  status:     'Open' | 'Partially Received';
}

// Per-fund revenue, expenditure, and fund balance.
export interface FundSummary {
  fund:             Fund;
  revenue:          number;
  expenditure:      number;
  beginningBalance: number;
  endingBalance:    number;
}

// ---- Vendor Intelligence -------------------------------------------------
export interface VendorSummary {
  vendor:    string;
  category:  string;
  mechanism: string;        // VirtualCard | ACH | EFT | Check
  txns:      number;
  total:     number;
  lastPaid:  string;        // 'YYYY-MM-DD'
  anomalies: number;
  anchor:    AnchorStatus;
}

export interface VendorsResponse {
  vendors:      VendorSummary[];
  mechanismMix: NamedValue[];
  topVendors:   NamedValue[];
}

export interface VendorFilter {
  q?:    string;   // vendor-name search
  dept?: string;
}

// ---- Department Analysis -------------------------------------------------
export interface DepartmentDetail extends BudgetLine {
  txns:      number;
  anomalies: number;
  topVendor: string;
}

export interface DepartmentAnalysisResponse {
  departments: DepartmentDetail[];
  heatmap:     Heatmap;
  byDept:      NamedValue[];
}

// ---- Contracts -----------------------------------------------------------
// A contract is the real procurement object (department is just a grouping).
// Payments roll up to a contract by matching its vendor within its department.
export type ContractStatus = 'Active' | 'Expiring' | 'Expired' | 'Closed';
export type ContractType   = 'Services' | 'Goods' | 'Construction' | 'Professional';
export type ContractFlag   = 'over_ceiling' | 'near_ceiling' | 'expiring' | 'po_breach' | 'stalled';

export interface Contract {
  id:         string;        // 'CON-2026-014'
  title:      string;
  vendor:     string;
  department: string;
  fund:       Fund;
  type:       ContractType;
  value:      number;        // not-to-exceed (total ceiling)
  poCeiling:  number;        // per-payment limit
  startDate:  string;        // 'YYYY-MM-DD'
  endDate:    string;        // 'YYYY-MM-DD'
  status:     ContractStatus;
  awardDate:  string;        // 'YYYY-MM-DD'
}

export interface ContractDetail extends Contract {
  spent:       number;
  remaining:   number;
  utilizedPct: number;       // spent / value
  payments:    Transaction[];
  flags:       ContractFlag[];
  severity:    number;       // for the "needs attention" ranking
  daysLeft:    number;       // until endDate (negative if past)
}

// ---- Administration ------------------------------------------------------
// Tenant admin console: governance + access + connections + settings.
export type AdminRole        = 'Administrator' | 'Finance' | 'Viewer';
export type UserStatus       = 'Active' | 'Invited' | 'Disabled';
export type ConnectionStatus = 'Connected' | 'Syncing' | 'Error' | 'Disconnected';

export interface AdminUser {
  id:        string;
  name:      string;
  email:     string;
  role:      AdminRole;
  status:    UserStatus;
  lastLogin: string;         // 'YYYY-MM-DD' or '' if never
  wallet?:   string;         // Stellar admin address (Administrators only)
}

export interface DataConnection {
  id:           string;
  name:         string;      // 'Plaid' | 'RePay' | 'Tyler Munis'
  kind:         string;      // 'Bank feed' | 'Card processor' | 'ERP'
  status:       ConnectionStatus;
  lastSync:     string;      // 'YYYY-MM-DD HH:mm'
  recordsToday: number;
  note?:        string;      // e.g. an error reason
}

export interface ClosedPeriod {
  monthKey:  string;         // 'YYYY-MM'
  closedAt:  string;         // 'YYYY-MM-DD'
  closedBy:  string;         // admin name
  records:   number;
  stellarTx: string;
}

export interface AuditEntry {
  id:               string;
  vendor:           string;
  previousCategory: string;
  newCategory:      string;
  admin:            string;  // admin name
  justification:    string;
  signedAt:         string;  // 'YYYY-MM-DD'
  tx:               string;  // stellar tx
}

export interface RulesetRule {
  mcc:      number;
  mccDesc:  string;
  category: string;
}

export interface TenantProfile {
  name:            string;
  tier:            string;   // population-based tier
  population:      string;
  fiscalYearStart: string;
  funds:           string[];
  retentionMonths: number;
  adminWallets:    string[]; // registered admin Stellar addresses
}

export interface AdminConsole {
  tenant:        TenantProfile;
  users:         AdminUser[];
  connections:   DataConnection[];
  closedPeriods: ClosedPeriod[];
  openMonth:     string;     // 'YYYY-MM' next period to close
  audit:         AuditEntry[];
  ruleset:       RulesetRule[];
}
