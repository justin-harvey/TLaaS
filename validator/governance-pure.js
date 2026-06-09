// validator/governance-pure.js
// ---------------------------------------------------------------------------
// Zero external dependencies — testable anywhere.
// Contains the canonical serialisation functions both client and server must
// call identically. Any drift between the two sides breaks signature verification.
// ---------------------------------------------------------------------------

/**
 * Deterministic serialisation of a category-override intent.
 * Keys are short (from the blueprint spec) so the JSON is stable.
 */
export function serialiseOverrideIntent(intent) {
    return JSON.stringify({
        t_id:     intent.tenantId,
        tx_id:    intent.transactionId,
        orig_cat: intent.originalCategory,
        req_cat:  intent.requestedCategory,
        reason:   intent.justification.trim(),
        time:     intent.timestamp,
    });
}

/**
 * Deterministic serialisation of a Close-of-Period intent.
 * The fingerprint being anchored is included in the signed payload so the
 * admin is committing to a specific hash, not an open-ended close.
 */
export function serialiseClosePeriodIntent(tenantId, monthKey, fingerprintHex, timestamp) {
    return JSON.stringify({
        action: 'close_period',
        t_id:   tenantId,
        month:  monthKey,
        hash:   fingerprintHex,
        time:   timestamp,
    });
}

/** Intent timestamp freshness guard: ±5 minutes. */
export function isTimestampFresh(timestamp, windowMs = 300_000) {
    return Math.abs(Date.now() - timestamp) <= windowMs;
}
