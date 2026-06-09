// validator/pipeline.js
// ---------------------------------------------------------------------------
// Tags validated Plaid transactions by MCC, writes them atomically to the
// repay_payment_ledger cache, increments usage metering, and returns the
// deterministic fingerprint that Phase 3 will anchor on-chain.
//
// Category tagging is driven entirely by the industry_mcc_ruleset table
// (seeded in Phase 1) — the database is the single source of truth, not
// hardcoded CASE logic.
//
// Imports pg, so this runs only against a live database.
// ---------------------------------------------------------------------------
import { buildSanitizedRow, computeFingerprint } from './fingerprint.js';

const UNCATEGORIZED = 'Uncategorized Expense';

/**
 * Fetch the tenant's industry-scoped MCC→category map as a JS Map (one query).
 */
async function loadTenantRuleset(client, tenantId) {
    const { rows } = await client.query(
        `SELECT r.mcc_code, r.assigned_category
           FROM industry_mcc_ruleset r
           JOIN tenants t ON t.industry_id = r.industry_id
          WHERE t.id = $1`,
        [tenantId]
    );
    const map = new Map();
    for (const r of rows) map.set(r.mcc_code, r.assigned_category);
    return map;
}

/**
 * Map a raw Plaid transaction onto the ledger column set.
 * Plaid has no invoices/vendor numbers, so those columns get safe defaults.
 */
function mapPlaidRow(tx, category) {
    const merchant = tx.raw_merchant.trim().toUpperCase();
    const isoDate = new Date(tx.date).toISOString().split('T')[0];
    return {
        // ledger columns
        payment_number:    tx.transaction_id,
        invoice_numbers:   ['UNASSIGNED'],                      // Plaid feeds carry no invoice ids
        vendor_number:     tx.merchant_entity_id || 'PLAID',
        vendor_name:       merchant,
        mcc_code:          tx.mcc_code,
        payment_mechanism: tx.payment_channel || 'PlaidACH',
        assigned_category: category,
        total_amount:      Number(tx.amount.toFixed(2)),
        payment_status:    tx.pending ? 'Pending' : 'Settled',
        creation_date:     isoDate,
        status_date:       isoDate,
        // hashing projection source
        _hash: { date: isoDate, merchant, mcc: tx.mcc_code, category, amount: tx.amount },
    };
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} tenantId
 * @param {Array} transactions  validated Plaid rows
 * @returns {{ success: boolean, rowsIngested: number, blockchainHash: string }}
 */
export async function ingestPlaidPayload(pool, tenantId, transactions) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ruleset = await loadTenantRuleset(client, tenantId);
        const sanitizedForHash = [];

        const insertSQL = `
            INSERT INTO repay_payment_ledger
                (tenant_id, payment_number, invoice_numbers, vendor_number, vendor_name,
                 mcc_code, payment_mechanism, assigned_category, total_amount, payment_status,
                 creation_date, status_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (payment_number) DO NOTHING`;

        for (const tx of transactions) {
            const category = ruleset.get(tx.mcc_code) || UNCATEGORIZED;
            const row = mapPlaidRow(tx, category);

            await client.query(insertSQL, [
                tenantId, row.payment_number, row.invoice_numbers, row.vendor_number, row.vendor_name,
                row.mcc_code, row.payment_mechanism, row.assigned_category, row.total_amount,
                row.payment_status, row.creation_date, row.status_date,
            ]);

            sanitizedForHash.push(buildSanitizedRow(row._hash));
        }

        // Usage metering: increment processed-row count for the current period.
        const period = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
        await client.query(
            `INSERT INTO tenant_billing_meters (tenant_id, billing_period, transactions_processed_count)
             VALUES ($1, $2, $3)
             ON CONFLICT (tenant_id, billing_period)
             DO UPDATE SET transactions_processed_count =
                 tenant_billing_meters.transactions_processed_count + EXCLUDED.transactions_processed_count`,
            [tenantId, period, transactions.length]
        );

        const blockchainHash = computeFingerprint(sanitizedForHash);

        await client.query('COMMIT');
        return { success: true, rowsIngested: transactions.length, blockchainHash };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🚨 Ingestion rolled back:', err.message);
        throw err;
    } finally {
        client.release();
    }
}
