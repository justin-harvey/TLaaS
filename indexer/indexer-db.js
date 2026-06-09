// indexer/indexer-db.js
// ---------------------------------------------------------------------------
// Pure DB logic for the indexer. No Stellar SDK dependency — fully unit-testable.
// indexer.js (which has the SDK) imports from here and adds the decode + poll layer.
// The pg Pool is always injected as a parameter — no pg import needed here.
// ---------------------------------------------------------------------------
import { buildSanitizedRow, computeFingerprint } from './fingerprint.js';

export async function recomputeAndVerify(pool, tenantId, monthKey, onChainHashHex) {
    const { rows } = await pool.query(
        `SELECT creation_date, vendor_name, mcc_code, assigned_category, total_amount
           FROM repay_payment_ledger
          WHERE tenant_id = $1 AND to_char(creation_date, 'YYYY-MM') = $2`,
        [tenantId, monthKey]
    );
    if (rows.length === 0) return false;
    const local = computeFingerprint(rows.map((r) => buildSanitizedRow({
        date: new Date(r.creation_date).toISOString().split('T')[0],
        merchant: r.vendor_name,
        mcc: r.mcc_code,
        category: r.assigned_category,
        amount: Number(r.total_amount),
    })));
    return local === onChainHashHex;
}

// Idempotent — meters exactly once per unique (tenant, month).
export async function recordAnchor(pool, d, verified) {
    const ins = await pool.query(
        `INSERT INTO stellar_anchors
            (tenant_id, month_key, stellar_tx_hash, ipfs_cid, calculated_sha256, is_verified)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id, month_key) DO NOTHING`,
        [d.tenantId, d.monthKey, d.txHash, d.ipfsCid, d.hashHex, verified]
    );

    if (ins.rowCount === 1) {
        await pool.query(
            `INSERT INTO tenant_billing_meters (tenant_id, billing_period, stellar_anchors_written_count)
             VALUES ($1, $2, 1)
             ON CONFLICT (tenant_id, billing_period)
             DO UPDATE SET stellar_anchors_written_count =
                 tenant_billing_meters.stellar_anchors_written_count + 1`,
            [d.tenantId, d.monthKey]
        );
        console.log(`⚓ NEW anchor tenant=${d.tenantId} ${d.monthKey} verified=${verified} tx=${d.txHash}`);
        return { ...d, verified, inserted: true };
    }
    await pool.query(
        `UPDATE stellar_anchors SET is_verified = $3, verified_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $1 AND month_key = $2`,
        [d.tenantId, d.monthKey, verified]
    );
    return { ...d, verified, inserted: false };
}

