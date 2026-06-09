// validator/test-pipeline.js
// ---------------------------------------------------------------------------
// Phase 2 Definition-of-Done gate. Requires a live DB (the Phase 1 schema).
//
//   docker compose -f ../docker-compose.db.yml up -d
//   npm install
//   DATABASE_URL=postgres://postgres:secret_password@localhost:5432/tlaas_ledger npm run test:integration
// ---------------------------------------------------------------------------
import assert from 'assert';
import * as fs from 'fs';
import pg from 'pg';
import { IngestionCircuitBreaker } from './circuit-breaker.js';
import { ingestPlaidPayload } from './pipeline.js';
import { computeFingerprint, buildSanitizedRow } from './fingerprint.js';

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

    // Clean slate for repeatable runs
    await pool.query(`DELETE FROM repay_payment_ledger WHERE tenant_id=$1`, [tenantId]);
    await pool.query(`DELETE FROM tenant_billing_meters WHERE tenant_id=$1`, [tenantId]);

    console.log('\n=== Clean payload ingests + tags via ruleset ===');
    const cleanRaw = fs.readFileSync('./samples/clean_plaid.json', 'utf8');
    const cleanRes = new IngestionCircuitBreaker('demo', 'automotive').validate(cleanRaw);
    let ingest;

    await check('circuit breaker passes clean payload', () => assert.strictEqual(cleanRes.ok, true));

    await check('3 rows ingested', async () => {
        ingest = await ingestPlaidPayload(pool, tenantId, cleanRes.transactions);
        assert.strictEqual(ingest.rowsIngested, 3);
    });

    await check('MCC tagged correctly for automotive (5533→Inventory Sourcing, 4900→Facilities Overhead, 5072→Shop Tools & Equipment)', async () => {
        const { rows } = await pool.query(
            `SELECT mcc_code, assigned_category FROM repay_payment_ledger WHERE tenant_id=$1 ORDER BY mcc_code`, [tenantId]);
        const map = Object.fromEntries(rows.map(r => [r.mcc_code, r.assigned_category]));
        assert.strictEqual(map[5533], 'Inventory Sourcing');
        assert.strictEqual(map[4900], 'Facilities Overhead');
        assert.strictEqual(map[5072], 'Shop Tools & Equipment');
    });

    await check('usage metering incremented by 3', async () => {
        const { rows } = await pool.query(
            `SELECT transactions_processed_count AS c FROM tenant_billing_meters WHERE tenant_id=$1`, [tenantId]);
        assert.strictEqual(Number(rows[0].c), 3);
    });

    await check('returned fingerprint matches recomputation from cache', async () => {
        const { rows } = await pool.query(
            `SELECT creation_date, vendor_name, mcc_code, assigned_category, total_amount
               FROM repay_payment_ledger WHERE tenant_id=$1`, [tenantId]);
        const recomputed = computeFingerprint(rows.map(r => buildSanitizedRow({
            date: new Date(r.creation_date).toISOString().split('T')[0],
            merchant: r.vendor_name, mcc: r.mcc_code, category: r.assigned_category, amount: Number(r.total_amount),
        })));
        assert.strictEqual(ingest.blockchainHash, recomputed);
    });

    console.log('\n=== Corrupted payload is rejected atomically ===');
    const badRaw = fs.readFileSync('./samples/corrupted_plaid.json', 'utf8');
    const badRes = new IngestionCircuitBreaker('demo', 'automotive').validate(badRaw);

    await check('circuit breaker rejects corrupted payload', () => assert.strictEqual(badRes.ok, false));

    await check('no corrupted rows reached the cache (still exactly 3)', async () => {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM repay_payment_ledger WHERE tenant_id=$1`, [tenantId]);
        assert.strictEqual(rows[0].c, 3);
    });

    console.log(`\n${passed} checks passed.`);
    console.log('✅ Phase 2 gate passed if all checks are green.\n');
    await pool.end();
}

main().catch(async (e) => { console.error('Fatal:', e.message); await pool.end(); process.exit(1); });
