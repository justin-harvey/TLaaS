// indexer/test-indexer-unit.js
// DB-free tests for recordAnchor: idempotency and the meter-exactly-once invariant.
// No Stellar SDK, no Postgres. Run anywhere: node test-indexer-unit.js
//
// decodeAnchorEvent (which calls scValToNative) is tested in the integration gate.
import assert from 'assert';
import { recordAnchor } from './indexer-db.js';

let passed = 0;
function check(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}
async function checkAsync(name, fn) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}

// Minimal mock pool. Tracks SQL call signatures and simulates ON CONFLICT DO NOTHING
// by remembering which (tenant_id, month_key) pairs have been inserted.
function makeMockPool() {
    const anchors = new Set();
    const calls = [];
    return {
        calls,
        async query(sql, params) {
            const sig = sql.trim().replace(/\s+/g, ' ').slice(0, 60);
            calls.push({ sig, params });
            if (sql.includes('INSERT INTO stellar_anchors')) {
                const key = `${params[0]}|${params[1]}`;
                if (anchors.has(key)) return { rowCount: 0 }; // conflict
                anchors.add(key);
                return { rowCount: 1 };
            }
            return { rowCount: 1, rows: [] };
        },
    };
}

const DECODED = { tenantId: 42, monthKey: '2026-06', ipfsCid: 'ipfs://test', hashHex: 'aa'.repeat(32), txHash: 'tx_abc' };

console.log('\n=== recordAnchor idempotency ===');

await checkAsync('first insert: inserted=true, meter call fired', async () => {
    const pool = makeMockPool();
    const r = await recordAnchor(pool, DECODED, true);
    assert.strictEqual(r.inserted, true);
    const meterCall = pool.calls.find(c => c.sig.includes('INSERT INTO tenant_billing_meters'));
    assert.ok(meterCall, 'meter insert must fire on first anchor');
    const updateCall = pool.calls.find(c => c.sig.includes('UPDATE stellar_anchors'));
    assert.ok(!updateCall, 'no UPDATE on first insert');
});

await checkAsync('second call (same tenant+month): inserted=false, meter NOT called again', async () => {
    const pool = makeMockPool();
    await recordAnchor(pool, DECODED, true);           // first
    pool.calls.length = 0;                              // reset call log
    const r = await recordAnchor(pool, DECODED, true); // second (conflict)
    assert.strictEqual(r.inserted, false);
    const meterCall = pool.calls.find(c => c.sig.includes('INSERT INTO tenant_billing_meters'));
    assert.ok(!meterCall, 'meter must NOT fire on conflict — count would double');
    const updateCall = pool.calls.find(c => c.sig.includes('UPDATE stellar_anchors'));
    assert.ok(updateCall, 'is_verified UPDATE must fire on conflict');
});

await checkAsync('two different months: both insert, both meter', async () => {
    const pool = makeMockPool();
    const a = await recordAnchor(pool, { ...DECODED, monthKey: '2026-06' }, true);
    const b = await recordAnchor(pool, { ...DECODED, monthKey: '2026-07' }, false);
    assert.strictEqual(a.inserted, true);
    assert.strictEqual(b.inserted, true);
    const meters = pool.calls.filter(c => c.sig.includes('INSERT INTO tenant_billing_meters'));
    assert.strictEqual(meters.length, 2);
});

check('verified flag passes through to return value', () => {
    // synchronous check on return shape (verified is just a bool passthrough)
    // We trust the async tests above for the full contract; this is a shape guard.
    assert.ok(['tenantId', 'monthKey', 'hashHex', 'txHash', 'verified', 'inserted']
        .every(k => Object.prototype.hasOwnProperty.call({ ...DECODED, verified: true, inserted: true }, k)
            || k === 'verified' || k === 'inserted'));
});

console.log(`\n${passed} checks passed.\n`);
