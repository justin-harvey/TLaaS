// src/lib/utils.ts

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function fmtUSD(n: number): string {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function truncHash(h: string, chars = 6): string {
  if (h.length <= chars + 4) return h;
  return `${h.slice(0, chars)}…${h.slice(-4)}`;
}

// ——————————————————————————————————————————————————————————————————
// Client-side fingerprint — ported from validator/fingerprint.js
// MUST stay byte-identical to the server contract (same projection + sort)
// ——————————————————————————————————————————————————————————————————
interface SanitizedRow {
  date:     string;   // 'YYYY-MM-DD'
  merchant: string;   // uppercased, trimmed
  mcc:      number | null;
  category: string;
  amount:   number;
}

function buildSanitizedRow(r: {
  date: string; merchant: string; mcc: number | null; category: string; amount: number;
}): SanitizedRow {
  return {
    date:     r.date,
    merchant: r.merchant,
    mcc:      r.mcc,
    category: r.category,
    amount:   Number(Number(r.amount).toFixed(2)),
  };
}

export async function computeFingerprint(rows: Parameters<typeof buildSanitizedRow>[0][]): Promise<string> {
  const sanitized = rows.map(buildSanitizedRow);
  const sorted = [...sanitized].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.merchant.localeCompare(b.merchant) ||
    ((a.mcc ?? 0) - (b.mcc ?? 0)) ||
    (a.amount - b.amount)
  );
  const json = JSON.stringify(sorted);
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
