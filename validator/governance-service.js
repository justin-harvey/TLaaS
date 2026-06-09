// validator/governance-service.js
// ---------------------------------------------------------------------------
// Phase 6 — Governance & Close-of-Period
//
// Two responsibilities:
//   applyOverride(pool, intent, publicKey, signatureB64)
//     → verifies Ed25519 sig, checks admin registry, applies override + audit
//
//   closePeriod(pool, tenantId, monthKey, publicKey, signatureB64)
//     → verifies sig, recomputes fingerprint, anchors on-chain (the ONLY path
//       that calls anchorHashToStellar — never called per-row)
//
// Security model:
//   Verification is TWO gates, both must pass:
//     Gate 1. Ed25519 signature is valid for the submitted intent bytes.
//     Gate 2. The signing public key matches the registered tenant admin
//             (DB cache of tenants.stellar_admin_address, set at onboarding
//              via the contract's set_tenant_admin + indexer sync).
//   The DB is never touched if either gate fails.
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { anchorHashToStellar } from './stellar-broadcast.js';
import { computeFingerprint, buildSanitizedRow } from './fingerprint.js';
import {
    serialiseOverrideIntent,
    serialiseClosePeriodIntent,
    isTimestampFresh,
} from './governance-pure.js';

export { serialiseOverrideIntent, serialiseClosePeriodIntent, isTimestampFresh };

// ---------------------------------------------------------------------------
// Gate 1: Ed25519 signature verification.
// Stellar's Keypair.sign(data) hashes internally (sha256 then ed25519).
// So Keypair.verify(data, sig) expects the same raw data bytes.
// The client calls Freighter's signMessage(intentJSON) and sends the
// raw 64-byte signature as base64.
// ---------------------------------------------------------------------------
export function verifySignature(intentBytes, signatureB64, publicKey) {
    try {
        const kp  = Keypair.fromPublicKey(publicKey);
        const sig = Buffer.from(signatureB64, 'base64');
        return kp.verify(Buffer.from(intentBytes), sig);
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Gate 2: Admin registry check against the DB-cached admin address.
// The tenants.stellar_admin_address column is set at onboarding and kept
// in sync by the indexer (via the contract's set_tenant_admin).
// ---------------------------------------------------------------------------
export async function isRegisteredAdmin(pool, tenantId, publicKey) {
    const { rows } = await pool.query(
        'SELECT stellar_admin_address FROM tenants WHERE id = $1',
        [tenantId]
    );
    if (rows.length === 0) return false;
    return rows[0].stellar_admin_address === publicKey;
}

// ---------------------------------------------------------------------------
// applyOverride: category reclassification with full audit trail.
// ---------------------------------------------------------------------------
export async function applyOverride(pool, intent, publicKey, signatureB64) {
    const intentString = serialiseOverrideIntent(intent);

    if (!verifySignature(intentString, signatureB64, publicKey)) {
        throw new Error('GOVERNANCE_REJECTED: Ed25519 signature is invalid.');
    }
    if (!await isRegisteredAdmin(pool, intent.tenantId, publicKey)) {
        throw new Error(`GOVERNANCE_REJECTED: ${publicKey} is not an authorised admin for tenant ${intent.tenantId}.`);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Audit log — immutable record of the change.
        await client.query(
            `INSERT INTO admin_override_audit_logs
                (tenant_id, ledger_row_id, admin_address, previous_category,
                 new_category, signed_intent, signature)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [intent.tenantId, intent.transactionId, publicKey,
             intent.originalCategory, intent.requestedCategory,
             intentString, signatureB64]
        );

        // 2. Apply the override to the ledger cache.
        const { rowCount } = await client.query(
            `UPDATE repay_payment_ledger
                SET assigned_category = $1, is_manually_overridden = TRUE
              WHERE id = $2 AND tenant_id = $3`,
            [intent.requestedCategory, intent.transactionId, intent.tenantId]
        );
        if (rowCount === 0) throw new Error(`Row ${intent.transactionId} not found for tenant ${intent.tenantId}.`);

        await client.query('COMMIT');
        console.log(`✏️  Override: tenant=${intent.tenantId} row=${intent.transactionId} ${intent.originalCategory} → ${intent.requestedCategory} by ${publicKey.slice(0, 8)}…`);
        return { success: true, rowsAffected: rowCount };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ---------------------------------------------------------------------------
// closePeriod: the ONLY path that calls anchorHashToStellar.
// Recomputes the fingerprint from the current cache state (post-overrides),
// verifies the signature, then anchors on-chain.
// ---------------------------------------------------------------------------
export async function closePeriod(pool, tenantId, monthKey, publicKey, signatureB64, submittedFingerprintHex) {
    // Recompute fingerprint server-side (source of truth).
    const { rows } = await pool.query(
        `SELECT creation_date, vendor_name, mcc_code, assigned_category, total_amount
           FROM repay_payment_ledger
          WHERE tenant_id = $1 AND to_char(creation_date,'YYYY-MM') = $2`,
        [tenantId, monthKey]
    );
    if (rows.length === 0) throw new Error(`No rows found for tenant ${tenantId} month ${monthKey}.`);

    const computedFingerprintHex = computeFingerprint(rows.map(r => buildSanitizedRow({
        date:     new Date(r.creation_date).toISOString().split('T')[0],
        merchant: r.vendor_name,
        mcc:      r.mcc_code,
        category: r.assigned_category,
        amount:   Number(r.total_amount),
    })));

    // Verify the submitted fingerprint matches what we computed.
    if (submittedFingerprintHex !== computedFingerprintHex) {
        throw new Error('GOVERNANCE_REJECTED: Submitted fingerprint does not match current ledger state. Re-fetch and re-sign.');
    }

    const intentString = serialiseClosePeriodIntent(tenantId, monthKey, computedFingerprintHex, Date.now());

    if (!verifySignature(intentString, signatureB64, publicKey)) {
        throw new Error('GOVERNANCE_REJECTED: Close-of-Period signature is invalid.');
    }
    if (!await isRegisteredAdmin(pool, tenantId, publicKey)) {
        throw new Error(`GOVERNANCE_REJECTED: ${publicKey} is not an authorised admin for tenant ${tenantId}.`);
    }

    // Gate passed — anchor on-chain. This is the ONLY call site of anchorHashToStellar.
    const ipfsCid = `ipfs://tlaas-${tenantId}-${monthKey}`; // placeholder until IPFS upload is wired
    const result  = await anchorHashToStellar(tenantId, monthKey, ipfsCid, computedFingerprintHex);

    console.log(`⚓ Period closed: tenant=${tenantId} month=${monthKey} hash=${computedFingerprintHex.slice(0, 12)}… tx=${result.hash.slice(0, 12)}…`);
    return { success: true, fingerprintHex: computedFingerprintHex, stellarTxHash: result.hash, ledger: result.ledger };
}
