// validator/test-repay-pipeline.js
// Phase 2.5 Definition-of-Done gate. Needs a live DB (Phase 1 schema + 2.5 seed).
//
//   docker compose -f ../docker-compose.db.yml up -d
//   npm install
//   DATABASE_URL=postgres://postgres:secret_password@localhost:5432/tlaas_ledger node test-repay-pipeline.js
import assert from 'assert';
import * as fs from 'fs';
import pg from 'pg';
import { RepayCircuitBreaker } from './repay-circuit-breaker.js';
import { ingestRepayPayload } from './repay-pipeline.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let passed = 0;
async function check(name, fn) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}

async function main() {
    const { rows: [tenant] } = await pool.query(`SELECT id FROM tenants WHERE slug='demo-auto'`);
    assert.ok(tenant, 'demo-auto tenant not found — run the Phase 1 schema first');
    const tenantId = tenant.id;

    await pool.query(`DELETE FROM repay_payment_ledger WHERE tenant_id=$1`, [tenantId]);
    await pool.query(`DELETE FROM tenant_billing_meters WHERE tenant_id=$1`, [tenantId]);

    console.log('\n=== Real screenshot export ingests + vendor-name tagging ===');
    const raw = fs.readFileSync('./samples/clean_repay.json', 'utf8');
    const res = new RepayCircuitBreaker('demo', 'automotive').validate(raw);
    let ingest;

    await check('breaker passes the 7-row export', () => assert.strictEqual(res.ok, true));

    await check('7 rows ingested', async () => {
        ingest = await ingestRepayPayload(pool, tenantId, res.rows);
        assert.strictEqual(ingest.rowsIngested, 7);
    });

    await check('vendor-name mapping (DECKER→Inventory, INTERSTATE→Shop Tools, FEDEX→Shipping, others→default)', async () => {
        const { rows } = await pool.query(
            `SELECT vendor_name, assigned_category FROM repay_payment_ledger WHERE tenant_id=$1`, [tenantId]);
        const cat = Object.fromEntries(rows.map(r => [r.vendor_name, r.assigned_category]));
        assert.strictEqual(cat['DECKER AUTO GLASS'], 'Inventory Sourcing');
        assert.strictEqual(cat['INTERSTATE BATTERY SYSTEMS'], 'Shop Tools & Battery Supplies');
        assert.strictEqual(cat['FEDEX'], 'Shipping Logistics');
        assert.strictEqual(cat['ALSO'], 'General Operating Costs');           // no rule -> default
        assert.strictEqual(cat['GH HUNTER SERVICE'], 'General Operating Costs');
    });

    await check('multi-invoice row parsed into array (DECKER has 3 invoices)', async () => {
        const { rows } = await pool.query(
            `SELECT invoice_numbers FROM repay_payment_ledger WHERE payment_number='WP12020260603' AND tenant_id=$1`, [tenantId]);
        assert.deepStrictEqual(rows[0].invoice_numbers, ['222797', '222619', '221540']);
    });

    await check('type normalized (VCard->VirtualCard, Check->Check/Cheque)', async () => {
        const { rows } = await pool.query(
            `SELECT DISTINCT payment_mechanism FROM repay_payment_ledger WHERE tenant_id=$1 ORDER BY 1`, [tenantId]);
        const mechs = rows.map(r => r.payment_mechanism);
        assert.deepStrictEqual(mechs, ['Check/Cheque', 'VirtualCard']);
    });

    await check('currency parsed ($1,370.00 -> 1370.00)', async () => {
        const { rows } = await pool.query(
            `SELECT total_amount FROM repay_payment_ledger WHERE payment_number='WP12020260603' AND tenant_id=$1`, [tenantId]);
        assert.strictEqual(Number(rows[0].total_amount), 1370);
    });

    console.log('\n=== Corrupted export rejected atomically ===');
    const badRaw = fs.readFileSync('./samples/corrupted_repay.json', 'utf8');
    const badRes = new RepayCircuitBreaker('demo', 'automotive').validate(badRaw);

    await check('breaker rejects corrupted export', () => assert.strictEqual(badRes.ok, false));
    await check('still exactly 7 rows (nothing corrupt leaked)', async () => {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM repay_payment_ledger WHERE tenant_id=$1`, [tenantId]);
        assert.strictEqual(rows[0].c, 7);
    });

    console.log(`\n${passed} checks passed.`);
    console.log('✅ Phase 2.5 gate passed if all checks are green.\n');
    await pool.end();
}
main().catch(async (e) => { console.error('Fatal:', e.message); await pool.end(); process.exit(1); });
