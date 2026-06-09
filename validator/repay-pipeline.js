// validator/repay-pipeline.js
// ---------------------------------------------------------------------------
// Ingests validated RePay rows into the same repay_payment_ledger cache.
// Category tagging is by VENDOR NAME (RePay has no MCC), driven by the
// vendor_category_rules table (seeded in Phase 1 / 2.5) — DB is the source
// of truth, not hardcoded vendor strings.
//
// Imports pg, so runs only against a live database.
// ---------------------------------------------------------------------------
import { buildSanitizedRow, computeFingerprint } from './fingerprint.js';
import { parseMoney, normalizeType, splitInvoices, parseRepayDate } from './parse.js';

const DEFAULT_CATEGORY = 'General Operating Costs';

/**
 * Load the tenant's industry vendor rules, ordered by priority (lowest first).
 * Returns an array of { match, category } with match already uppercased.
 */
async function loadVendorRules(client, tenantId) {
    const { rows } = await client.query(
        `SELECT UPPER(v.match_substring) AS match, v.assigned_category AS category
           FROM vendor_category_rules v
           JOIN tenants t ON t.industry_id = v.industry_id
          WHERE t.id = $1
          ORDER BY v.priority ASC, length(v.match_substring) DESC`,
        [tenantId]
    );
    return rows;
}

function categorize(vendorUpper, rules) {
    for (const rule of rules) {
        if (vendorUpper.includes(rule.match)) return rule.category;
    }
    return DEFAULT_CATEGORY;
}

function mapRepayRow(r, category) {
    const merchant = r.vendor_name.trim().toUpperCase();
    const isoDate = parseRepayDate(r.creation_date);
    const statusDate = parseRepayDate(r.status_date) || isoDate;
    return {
        payment_number:    r.payment_number,
        invoice_numbers:   splitInvoices(r.invoice_numbers),
        vendor_number:     r.vendor_number || 'UNKNOWN',
        vendor_name:       merchant,
        mcc_code:          null,                       // RePay carries no MCC
        payment_mechanism: normalizeType(r.payment_type),
        assigned_category: category,
        total_amount:      Number(parseMoney(r.total_amount).toFixed(2)),
        available_amount:  isNaN(parseMoney(r.available_amount)) ? 0 : Number(parseMoney(r.available_amount).toFixed(2)),
        payment_status:    r.status || 'Pending',
        creation_date:     isoDate,
        status_date:       statusDate,
        _hash: { date: isoDate, merchant, mcc: null, category, amount: parseMoney(r.total_amount) },
    };
}

export async function ingestRepayPayload(pool, tenantId, rows) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const rules = await loadVendorRules(client, tenantId);
        const sanitizedForHash = [];

        const insertSQL = `
            INSERT INTO repay_payment_ledger
                (tenant_id, payment_number, invoice_numbers, vendor_number, vendor_name,
                 mcc_code, payment_mechanism, assigned_category, total_amount, available_amount,
                 payment_status, creation_date, status_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            ON CONFLICT (payment_number) DO NOTHING`;

        for (const r of rows) {
            const merchantUpper = r.vendor_name.trim().toUpperCase();
            const category = categorize(merchantUpper, rules);
            const row = mapRepayRow(r, category);

            await client.query(insertSQL, [
                tenantId, row.payment_number, row.invoice_numbers, row.vendor_number, row.vendor_name,
                row.mcc_code, row.payment_mechanism, row.assigned_category, row.total_amount,
                row.available_amount, row.payment_status, row.creation_date, row.status_date,
            ]);
            sanitizedForHash.push(buildSanitizedRow(row._hash));
        }

        const period = new Date().toISOString().slice(0, 7);
        await client.query(
            `INSERT INTO tenant_billing_meters (tenant_id, billing_period, transactions_processed_count)
             VALUES ($1, $2, $3)
             ON CONFLICT (tenant_id, billing_period)
             DO UPDATE SET transactions_processed_count =
                 tenant_billing_meters.transactions_processed_count + EXCLUDED.transactions_processed_count`,
            [tenantId, period, rows.length]
        );

        const blockchainHash = computeFingerprint(sanitizedForHash);
        await client.query('COMMIT');
        return { success: true, rowsIngested: rows.length, blockchainHash };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🚨 RePay ingestion rolled back:', err.message);
        throw err;
    } finally {
        client.release();
    }
}
