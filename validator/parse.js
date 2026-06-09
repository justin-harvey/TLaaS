// validator/parse.js
// ---------------------------------------------------------------------------
// RePay export normalizers. The export differs from the dashboard:
//   * money arrives as "$1,146.36"
//   * Type arrives abbreviated ("VCard","Check") vs dashboard full names
//   * Invoice(s) may be a comma/newline string or already an array
//   * dates look like "6/03/2026, 12:17:35 PM"
// Pure functions — unit-testable anywhere.
// ---------------------------------------------------------------------------

// Export abbreviation -> canonical dashboard payment mechanism.
const TYPE_MAP = {
    VCARD: 'VirtualCard',
    VIRTUALCARD: 'VirtualCard',
    CHECK: 'Check/Cheque',
    'CHECK/CHEQUE': 'Check/Cheque',
    CHEQUE: 'Check/Cheque',
    ACH: 'ACH',
    'VENDOR-PAID ACH': 'Vendor-Paid ACH',
    EFT: 'EFT',
};

export function parseMoney(v) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return NaN;
    return parseFloat(v.replace(/[$,\s]/g, ''));
}

export function normalizeType(t) {
    if (typeof t !== 'string') return null;
    return TYPE_MAP[t.trim().toUpperCase()] || t.trim();
}

// Strict allowlist check for validation: RePay only emits these types.
export function isKnownType(t) {
    return typeof t === 'string' && Object.prototype.hasOwnProperty.call(TYPE_MAP, t.trim().toUpperCase());
}

export function splitInvoices(v) {
    if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim()) {
        return v.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    }
    return ['UNASSIGNED'];
}

export function parseRepayDate(v) {
    const d = new Date(v);
    return isNaN(d) ? null : d.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}
