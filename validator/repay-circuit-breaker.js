// validator/repay-circuit-breaker.js
// ---------------------------------------------------------------------------
// 3-tier validation for the RePay flat-file export. Unlike the Plaid path,
// RePay rows carry NO MCC — categorisation is by vendor name downstream — so
// MCC is not required here. Validates the fields RePay actually provides.
// Pure module.
// ---------------------------------------------------------------------------
import { ceilingFor } from './industry-limits.js';
import { parseMoney, parseRepayDate, isKnownType } from './parse.js';

export class RepayCircuitBreaker {
    constructor(tenantName, industryType) {
        this.tenantName = tenantName;
        this.industryType = (industryType || '_default').toLowerCase();
        this.errors = [];
    }

    logError(rowNum, field, rawValue, message) {
        this.errors.push({ row: rowNum, field, invalidValue: rawValue, errorReason: message });
    }

    validate(rawContent) {
        // --- TIER 1: STRUCTURAL ---
        let rows;
        try {
            rows = JSON.parse(rawContent);
        } catch (e) {
            this.logError(0, 'JSON Syntax', null, `Malformed file format: ${e.message}`);
            return this._fail();
        }
        if (!Array.isArray(rows)) {
            this.logError(0, 'JSON Shape', null, 'Payload must be a flat JSON array.');
            return this._fail();
        }
        if (rows.length === 0) {
            this.logError(0, 'Payload Size', 0, 'Empty payment export detected.');
            return this._fail();
        }

        // --- TIER 2 (row) + TIER 3 (business) ---
        const ceiling = ceilingFor(this.industryType);
        const seen = new Set();

        rows.forEach((r, i) => {
            const rowNum = i + 1;

            // Payment number — unique key / our payment_number
            if (!r.payment_number || typeof r.payment_number !== 'string') {
                this.logError(rowNum, 'payment_number', r.payment_number, 'Missing or non-string payment number.');
            } else if (seen.has(r.payment_number)) {
                this.logError(rowNum, 'payment_number', r.payment_number, 'Duplicate payment number within file.');
            } else {
                seen.add(r.payment_number);
            }

            // Vendor name — the basis for category mapping
            if (!r.vendor_name || typeof r.vendor_name !== 'string' || r.vendor_name.trim().length === 0) {
                this.logError(rowNum, 'vendor_name', r.vendor_name, 'Vendor name cannot be null or empty.');
            }

            // Payment type — must be a known RePay mechanism
            if (!isKnownType(r.payment_type)) {
                this.logError(rowNum, 'payment_type', r.payment_type, 'Missing or unrecognized payment type.');
            }

            // Amount — handles "$1,146.36"
            const amt = parseMoney(r.total_amount);
            if (isNaN(amt)) {
                this.logError(rowNum, 'total_amount', r.total_amount, 'Amount is not a parseable currency value.');
            } else if (amt <= 0) {
                this.logError(rowNum, 'total_amount', r.total_amount, 'Zero or negative amounts are prohibited.');
            } else if (amt > ceiling) {
                this.logError(rowNum, 'total_amount', r.total_amount,
                    `Anomalous volume: single ${this.industryType} payment exceeds ceiling ($${ceiling.toLocaleString()}).`);
            }

            // Date
            if (!parseRepayDate(r.creation_date)) {
                this.logError(rowNum, 'creation_date', r.creation_date, 'Missing or invalid creation date.');
            }
        });

        if (this.errors.length > 0) return this._fail();
        return { ok: true, errors: [], rows };
    }

    _fail() {
        return { ok: false, errors: this.errors, rows: [] };
    }
}
