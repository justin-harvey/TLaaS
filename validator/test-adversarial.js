// validator/test-adversarial.js
// Phase 8 hardening suite — DB-free adversarial tests.
// Proves the three defences that matter most before go-live:
//   1. Tamper detection   — a single changed cent produces a different fingerprint.
//   2. Replay idempotency — re-scanning the same anchors never double-meters.
//   3. Load resilience    — circuit breaker quarantines 50 bad files without leaking.
//
// Run: node test-adversarial.js
import assert from 'assert';
import { IngestionCircuitBreaker } from './circuit-breaker.js';
import { RepayCircuitBreaker }    from './repay-circuit-breaker.js';
import { buildSanitizedRow, computeFingerprint } from './fingerprint.js';
import { recordAnchor } from '../indexer/indexer-db.js';

let passed = 0;
async function check(name, fn) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}

// ── 1. Tamper detection ───────────────────────────────────────────────────
console.log('\n=== 1. Tamper detection (fingerprint integrity) ===');

const CLEAN_ROWS = [
    { date: '2026-06-03', merchant: 'DECKER AUTO GLASS', mcc: 5533, category: 'Inventory Sourcing', amount: 1370.00 },
    { date: '2026-06-04', merchant: 'INTERSTATE BATTERY', mcc: 5072, category: 'Shop Tools',         amount: 145.95 },
    { date: '2026-06-05', merchant: 'FEDEX',              mcc: null, category: 'Shipping Logistics',  amount: 195.00 },
];
const sanitized = CLEAN_ROWS.map(buildSanitizedRow);
const originalHash = computeFingerprint(sanitized);

await check('same rows → same fingerprint across invocations', async () => {
    assert.strictEqual(computeFingerprint(sanitized), originalHash);
});
await check('row order shuffle → same fingerprint (sort-invariant)', async () => {
    const shuffled = [sanitized[2], sanitized[0], sanitized[1]];
    assert.strictEqual(computeFingerprint(shuffled), originalHash);
});
await check('1¢ change → different fingerprint (tamper detected)', async () => {
    const tampered = sanitized.map((r, i) => i === 0 ? { ...r, amount: r.amount + 0.01 } : r);
    assert.notStrictEqual(computeFingerprint(tampered), originalHash);
});
await check('vendor name change → different fingerprint', async () => {
    const tampered = sanitized.map((r, i) => i === 1 ? { ...r, merchant: 'FRAUD VENDOR' } : r);
    assert.notStrictEqual(computeFingerprint(tampered), originalHash);
});
await check('category reclassification → different fingerprint (override visible)', async () => {
    const overridden = sanitized.map((r, i) => i === 2 ? { ...r, category: 'Uncategorized' } : r);
    assert.notStrictEqual(computeFingerprint(overridden), originalHash);
});
await check('extra row appended → different fingerprint', async () => {
    const extra = [...sanitized, buildSanitizedRow({ date: '2026-06-06', merchant: 'GHOST INC', mcc: 9999, category: 'Unknown', amount: 0.01 })];
    assert.notStrictEqual(computeFingerprint(extra), originalHash);
});

// ── 2. Replay / anchor idempotency ─────────────────────────────────────────
console.log('\n=== 2. Replay idempotency (anchor + meter-once) ===');

const D = { tenantId: 1, monthKey: '2026-06', ipfsCid: 'ipfs://x', hashHex: 'aa'.repeat(32), txHash: 'tx_1' };

function freshPool() {
    const anchors = new Set();
    const calls = [];
    return {
        calls,
        async query(sql, params = []) {
            calls.push(sql.trim().slice(0, 30));
            if (sql.includes('INSERT INTO stellar_anchors')) {
                const k = `${params[0]}|${params[1]}`; // tenantId|monthKey from actual args
                if (anchors.has(k)) return { rowCount: 0 };
                anchors.add(k); return { rowCount: 1 };
            }
            return { rowCount: 1 };
        },
    };
}

await check('anchor inserted on first event', async () => {
    const pool = freshPool();
    const r = await recordAnchor(pool, D, true);
    assert.strictEqual(r.inserted, true);
});
await check('same anchor event re-scanned → no second meter charge', async () => {
    const pool = freshPool();
    await recordAnchor(pool, D, true);
    pool.calls.length = 0;
    await recordAnchor(pool, D, true);
    const meters = pool.calls.filter(c => c.includes('INSERT INTO tenant_billing'));
    assert.strictEqual(meters.length, 0, 'meter must not fire twice for same anchor');
});
await check('10 replays of the same anchor → still exactly 1 meter charge (total)', async () => {
    const pool = freshPool();
    for (let i = 0; i < 10; i++) await recordAnchor(pool, D, true);
    const meters = pool.calls.filter(c => c.includes('INSERT INTO tenant_billing'));
    assert.strictEqual(meters.length, 1);
});
await check('two different months → two anchors, two meter charges', async () => {
    const pool = freshPool();
    await recordAnchor(pool, { ...D, monthKey: '2026-06' }, true);
    await recordAnchor(pool, { ...D, monthKey: '2026-07' }, false);
    const meters = pool.calls.filter(c => c.includes('INSERT INTO tenant_billing'));
    assert.strictEqual(meters.length, 2);
});

// ── 3. Circuit-breaker load resilience ─────────────────────────────────────
console.log('\n=== 3. Load resilience (50 malformed payloads) ===');

function badPayload(i) {
    return JSON.stringify([{
        transaction_id: `tx_${i}`,
        raw_merchant: '',          // empty → tier-2 fail
        mcc_code: -1,             // bad MCC → tier-2 fail
        amount: -999 * i,         // negative → tier-2 fail
        date: 'NOT_A_DATE',       // bad date → tier-2 fail
    }]);
}
function badRepayPayload(i) {
    return JSON.stringify([{
        payment_number: `wp_${i}`,
        vendor_name: '',           // empty → fail
        payment_type: 'MYSTERY',  // unknown → fail
        total_amount: '-$500',    // negative after parse → fail
        creation_date: 'BAD',
    }]);
}

await check('50 bad Plaid payloads all rejected, none pass the breaker', async () => {
    let rejected = 0;
    for (let i = 0; i < 50; i++) {
        const r = new IngestionCircuitBreaker('t', 'automotive').validate(badPayload(i));
        if (!r.ok) rejected++;
    }
    assert.strictEqual(rejected, 50);
});
await check('50 bad RePay payloads all rejected', async () => {
    let rejected = 0;
    for (let i = 0; i < 50; i++) {
        const r = new RepayCircuitBreaker('t', 'automotive').validate(badRepayPayload(i));
        if (!r.ok) rejected++;
    }
    assert.strictEqual(rejected, 50);
});
await check('clean payload still passes after 50 bad ones (no state bleed)', async () => {
    const good = JSON.stringify([{
        transaction_id: 'tx_clean', raw_merchant: 'ACME', mcc_code: 5533, amount: 100, date: '2026-06-01',
    }]);
    const r = new IngestionCircuitBreaker('t', 'automotive').validate(good);
    assert.strictEqual(r.ok, true, 'clean payload must still pass');
});

console.log(`\n${passed} checks passed.\n`);
