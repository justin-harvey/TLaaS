// validator/circuit-breaker.js
// ---------------------------------------------------------------------------
// Tier 1 (structural) + Tier 2 (row) + Tier 3 (business logic) defense.
// Nothing reaches Postgres or Stellar until this passes.
//
// Pure: takes a raw string, returns a result object. File IO lives in index.js.
// ---------------------------------------------------------------------------
import { ceilingFor } from './industry-limits.js';

export class IngestionCircuitBreaker {
    constructor(tenantName, industryType) {
        this.tenantName = tenantName;
        this.industryType = (industryType || '_default').toLowerCase();
        this.errors = [];
    }

    logError(rowNum, field, rawValue, message) {
        this.errors.push({ row: rowNum, field, invalidValue: rawValue, errorReason: message });
    }

    ceiling() {
        return ceilingFor(this.industryType);
    }

    /**
     * @param {string} rawContent  raw JSON file contents
     * @returns {{ ok: boolean, errors: Array, transactions: Array }}
     */
    validate(rawContent) {
        // --- TIER 1: STRUCTURAL ---
        let transactions;
        try {
            transactions = JSON.parse(rawContent);
        } catch (e) {
            this.logError(0, 'JSON Syntax', null, `Malformed file format: ${e.message}`);
            return this._fail();
        }
        if (!Array.isArray(transactions)) {
            this.logError(0, 'JSON Shape', null, 'Payload must be a flat JSON array.');
            return this._fail();
        }
        if (transactions.length === 0) {
            this.logError(0, 'Payload Size', 0, 'Empty ledger upload detected.');
            return this._fail();
        }

        // --- TIER 2 (row) + TIER 3 (business logic) ---
        const ceiling = this.ceiling();
        const seenTxIds = new Set();

        transactions.forEach((tx, index) => {
            const rowNum = index + 1;

            // Unique transaction id (Plaid path key; also our payment_number)
            if (!tx.transaction_id || typeof tx.transaction_id !== 'string') {
                this.logError(rowNum, 'transaction_id', tx.transaction_id, 'Missing or non-string transaction id.');
            } else if (seenTxIds.has(tx.transaction_id)) {
                this.logError(rowNum, 'transaction_id', tx.transaction_id, 'Duplicate transaction id within file.');
            } else {
                seenTxIds.add(tx.transaction_id);
            }

            // Merchant
            if (!tx.raw_merchant || typeof tx.raw_merchant !== 'string' || tx.raw_merchant.trim().length === 0) {
                this.logError(rowNum, 'raw_merchant', tx.raw_merchant, 'Merchant name cannot be null or empty.');
            }

            // Date (ISO-parseable)
            if (!tx.date || isNaN(Date.parse(tx.date))) {
                this.logError(rowNum, 'date', tx.date, 'Missing or invalid date timestamp.');
            }

            // Amount
            if (tx.amount === undefined || typeof tx.amount !== 'number' || isNaN(tx.amount)) {
                this.logError(rowNum, 'amount', tx.amount, 'Amount must be a valid number.');
            } else if (tx.amount <= 0) {
                this.logError(rowNum, 'amount', tx.amount, 'Zero or negative amounts are prohibited in public expense ledgers.');
            } else if (tx.amount > ceiling) {
                this.logError(rowNum, 'amount', tx.amount,
                    `Anomalous volume: single ${this.industryType} transaction exceeds ceiling ($${ceiling.toLocaleString()}).`);
            }

            // MCC — the critical field for the Plaid path
            if (tx.mcc_code === undefined || typeof tx.mcc_code !== 'number' || !Number.isInteger(tx.mcc_code)
                || tx.mcc_code < 1000 || tx.mcc_code > 9999) {
                this.logError(rowNum, 'mcc_code', tx.mcc_code, 'MCC must be a 4-digit integer (1000–9999).');
            }
        });

        if (this.errors.length > 0) return this._fail();
        return { ok: true, errors: [], transactions };
    }

    _fail() {
        return { ok: false, errors: this.errors, transactions: [] };
    }
}
