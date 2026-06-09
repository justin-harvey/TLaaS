// indexer/test-indexer.js
// Phase 4 Definition-of-Done gate.
// Prereqs: live DB (Phase 1), deployed contract (Phase 3), env vars set.
//
//   cd indexer && npm install
//   DATABASE_URL=... SOROBAN_LEDGER_CONTRACT_ID=... SERVER_SECRET_KEY=...
//   STELLAR_RPC_URL=... STELLAR_NETWORK_PASSPHRASE=... node test-indexer.js
import assert from 'assert';
import pg from 'pg';
import { rpc } from '@stellar/stellar-sdk';
import 'dotenv/config';
import { runOnce } from './indexer.js';
import { recomputeAndVerify } from './indexer-db.js';
// Cross-package import: validator broadcast worker anchors on behalf of this test.
import { anchorHashToStellar } from '../validator/stellar-broadcast.js';
import { buildSanitizedRow, computeFingerprint } from './fingerprint.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const server = new rpc.Server(process.env.STELLAR_RPC_URL);
const TEST_MONTH = '2026-07';
let passed = 0;

async function check(name, fn) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}

async function main() {
    const { rows: [tenant] } = await pool.query(`SELECT id FROM tenants WHERE slug='demo-auto'`);
    assert.ok(tenant, 'demo-auto tenant not found — run Phase 1 schema first.');
    const tenantId = tenant.id;

    // Clean slate for the test month.
    await pool.query(`DELETE FROM repay_payment_ledger WHERE tenant_id=$1 AND to_char(creation_date,'YYYY-MM')=$2`, [tenantId, TEST_MONTH]);
    await pool.query(`DELETE FROM stellar_anchors WHERE tenant_id=$1 AND month_key=$2`, [tenantId, TEST_MONTH]);

    // Seed two known rows.
    await pool.query(`INSERT INTO repay_payment_ledger
        (tenant_id,payment_number,invoice_numbers,vendor_number,vendor_name,mcc_code,
         payment_mechanism,assigned_category,total_amount,payment_status,creation_date,status_date)
        VALUES
        ($1,'TEST_TX1',ARRAY['INV1'],'V1','DECKER AUTO GLASS',5533,'VirtualCard','Inventory Sourcing',1000.00,'Settled','2026-07-10','2026-07-10'),
        ($1,'TEST_TX2',ARRAY['INV2'],'V2','FEDEX',NULL,'Check/Cheque','Shipping Logistics',250.00,'Settled','2026-07-15','2026-07-15')`,
        [tenantId]);

    // Compute expected fingerprint the same way recomputeAndVerify does.
    const { rows } = await pool.query(
        `SELECT creation_date, vendor_name, mcc_code, assigned_category, total_amount
           FROM repay_payment_ledger WHERE tenant_id=$1 AND to_char(creation_date,'YYYY-MM')=$2`,
        [tenantId, TEST_MONTH]);
    const expectedHash = computeFingerprint(rows.map(r => buildSanitizedRow({
        date: new Date(r.creation_date).toISOString().split('T')[0],
        merchant: r.vendor_name, mcc: r.mcc_code,
        category: r.assigned_category, amount: Number(r.total_amount),
    })));
    console.log(`Expected fingerprint: ${expectedHash.slice(0, 16)}...`);

    console.log('\n=== Anchor on-chain ===');
    let txResult;
    await check('anchor_record accepted by contract', async () => {
        txResult = await anchorHashToStellar(tenantId, TEST_MONTH, 'ipfs://test-gate', expectedHash);
        assert.ok(txResult.hash, 'expected a transaction hash back');
        console.log(`   tx: ${txResult.hash.slice(0, 16)}...`);
    });

    console.log('\n=== Indexer poll ===');
    await check('runOnce detects the event', async () => {
        const handled = await runOnce(pool, server);
        const mine = handled.find(r => r.tenantId === tenantId && r.monthKey === TEST_MONTH);
        assert.ok(mine, 'indexer did not find the anchor event — try increasing INDEXER_LOOKBACK');
    });

    await check('stellar_anchors row written with is_verified=true', async () => {
        const { rows: [row] } = await pool.query(
            `SELECT is_verified, calculated_sha256 FROM stellar_anchors WHERE tenant_id=$1 AND month_key=$2`,
            [tenantId, TEST_MONTH]);
        assert.ok(row, 'stellar_anchors row not found');
        assert.strictEqual(row.calculated_sha256, expectedHash);
        assert.strictEqual(row.is_verified, true,
            'Hashes did not match — fingerprint projection may differ from contract anchor');
    });

    console.log(`\n${passed} checks passed.`);
    console.log('✅ Phase 4 gate passed if all checks are green.\n');
    await pool.end();
}
main().catch(async e => { console.error('Fatal:', e.message); await pool.end(); process.exit(1); });
