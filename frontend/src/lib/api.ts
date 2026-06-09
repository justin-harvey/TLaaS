// src/lib/api.ts — typed API client (REST surface from the handoff README)
import type {
  OverviewResponse, TransactionListResponse, Transaction,
  VerifyResponse, QueryNLResponse, QuerySQLResponse,
  AnomaliesResponse, TxFilter,
} from '@/types';
import * as fx from './fixtures';

// Toggle: set NEXT_PUBLIC_API_URL in .env to point at the real backend.
// Without it, all calls return mock fixture data.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
const useMock = !BASE;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ---- /api/overview -------------------------------------------------------
export async function getOverview(): Promise<OverviewResponse> {
  if (useMock) return {
    kpis: { budget: fx.totalBudget, spend: fx.totalSpent, remaining: fx.totalBudget - fx.totalSpent, anchoredCount: fx.anchoredCount },
    trend: { months: fx.trendMonths, values: fx.spendTrend },
    departments: fx.departments,
    recentAnchors: fx.transactions.filter(t => t.anchor === 'anchored').slice(0, 5),
    recentAnomalies: fx.anomalies,
  };
  return get<OverviewResponse>('/api/overview');
}

// ---- /api/transactions ---------------------------------------------------
export async function getTransactions(filter: TxFilter = {}): Promise<TransactionListResponse> {
  if (useMock) {
    let rows = fx.transactions;
    if (filter.dept)   rows = rows.filter(t => t.department === filter.dept);
    if (filter.vendor) rows = rows.filter(t => t.vendor.toLowerCase().includes(filter.vendor!.toLowerCase()));
    if (filter.anchor) rows = rows.filter(t => t.anchor === filter.anchor);
    if (filter.anomaly)rows = rows.filter(t => t.anomaly === filter.anomaly);
    return { rows, total: rows.length };
  }
  const params = new URLSearchParams(Object.entries(filter).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]));
  return get<TransactionListResponse>(`/api/transactions?${params}`);
}

// ---- /api/transactions/:id -----------------------------------------------
export async function getTransaction(id: string): Promise<Transaction> {
  if (useMock) {
    const t = fx.transactions.find(t => t.id === id);
    if (!t) throw new Error('Not found');
    return t;
  }
  return get<Transaction>(`/api/transactions/${id}`);
}

// ---- /api/verify/:id -----------------------------------------------------
export async function verifyRecord(id: string): Promise<VerifyResponse> {
  if (useMock) {
    const t = fx.transactions.find(t => t.id === id);
    if (!t) throw new Error('Not found');
    return { cacheHash: t.sha256, ledgerHash: t.sha256, match: true, ledgerTx: t.ledgerTx, block: t.block, timestamp: t.ts };
  }
  return get<VerifyResponse>(`/api/verify/${id}`);
}

// ---- /api/query/nl -------------------------------------------------------
export async function queryNL(question: string): Promise<QueryNLResponse> {
  if (useMock) return { sql: `SELECT vendor, SUM(amount) AS total\nFROM repay_payment_ledger\nWHERE tenant_id = 1\nGROUP BY vendor\nORDER BY total DESC\nLIMIT 10;`, modelNotes: 'Top vendors by total spend.' };
  return post<QueryNLResponse>('/api/query/nl', { question });
}

// ---- /api/query/sql -------------------------------------------------------
export async function querySQL(sql: string): Promise<QuerySQLResponse> {
  if (useMock) return { columns: ['vendor', 'total'], rows: fx.transactions.slice(0, 5).map(t => [t.vendor, t.amount]), meta: { rowCount: 5, ms: 12, servedFromCache: true, fingerprintVerified: true } };
  return post<QuerySQLResponse>('/api/query/sql', { sql });
}

// ---- /api/anomalies ------------------------------------------------------
export async function getAnomalies(): Promise<AnomaliesResponse> {
  if (useMock) return { items: fx.anomalies, heatmap: fx.heatmap };
  return get<AnomaliesResponse>('/api/anomalies');
}
