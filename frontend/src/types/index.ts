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
    budget:         number;
    spend:          number;
    remaining:      number;
    anchoredCount:  number;
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
export type PageId = 'overview' | 'ledger' | 'query' | 'verify' | 'anomalies';
