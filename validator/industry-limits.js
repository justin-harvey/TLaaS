// validator/industry-limits.js
// Single source for per-industry single-transaction ceilings (Tier 3).
export const ANOMALY_CEILING = {
    automotive: 500_000,
    healthcare: 5_000_000,
    utilities:  20_000_000,
    municipal:  10_000_000,
    _default:   1_000_000,
};

export function ceilingFor(industryType) {
    const key = (industryType || '_default').toLowerCase();
    return ANOMALY_CEILING[key] ?? ANOMALY_CEILING._default;
}
