// validator/fingerprint.js
// ⚠️ COPY of validator/fingerprint.js — MUST stay byte-identical (shared hash contract).
// ---------------------------------------------------------------------------
// The deterministic SHA-256 fingerprint contract.
//
// CRITICAL INVARIANT: the Phase 5 frontend "Verify Data Integrity" engine must
// reproduce this byte-for-byte. If the projection or sort here changes, the
// frontend must change identically or every verification will false-alarm.
//
// Pure module — no DB, no fs. Safe to unit-test anywhere.
// ---------------------------------------------------------------------------
import crypto from 'crypto';

/**
 * Canonical sanitized projection of a ledger row used for hashing.
 * Only these fields are hashed — PII / internal ids are deliberately excluded.
 */
export function buildSanitizedRow(r) {
    return {
        date:     r.date,                     // 'YYYY-MM-DD'
        merchant: r.merchant,                 // uppercased + trimmed
        mcc:      r.mcc,                       // integer banking code
        category: r.category,                 // assigned dashboard bucket
        amount:   Number(Number(r.amount).toFixed(2))
    };
}

/**
 * Deterministic SHA-256 over the sorted sanitized rows.
 * Sort keys make ordering independent of file row order. Rows that tie on all
 * sort keys serialize identically, so their relative order can't change the hash.
 */
export function computeFingerprint(sanitizedRows) {
    const sorted = [...sanitizedRows].sort((a, b) =>
        a.date.localeCompare(b.date) ||
        a.merchant.localeCompare(b.merchant) ||
        (a.mcc - b.mcc) ||
        (a.amount - b.amount)
    );
    return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}
