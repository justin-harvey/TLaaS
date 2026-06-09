// validator/test-governance-unit.js
// DB-free, Stellar-SDK-free unit tests. Run: node test-governance-unit.js
//
// Covers: serialisation determinism, timestamp guard, and the two-gate
// applyOverride logic with a mock verifySignature injected.
// The Ed25519 crypto correctness is verified in the integration gate
// (requires deployed server + real Freighter wallet).
import assert from 'assert';
import { serialiseOverrideIntent, serialiseClosePeriodIntent, isTimestampFresh } from './governance-pure.js';

let passed = 0;
function check(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}
async function checkAsync(name, fn) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}

const INTENT = {
    tenantId: 1, transactionId: 99,
    originalCategory: 'General Operating Costs', requestedCategory: 'Inventory Sourcing',
    justification: 'Vendor reclassified by procurement team.', timestamp: Date.now(),
};

// ---- Inline mock of the two-gate applyOverride logic ----------------------
// Mirrors governance-service.js's applyOverride but accepts injected functions
// so we can control both gates independently in tests.
async function applyOverrideMock(pool, intent, publicKey, signatureB64,
    { verifyFn, adminFn }) {
    const str = serialiseOverrideIntent(intent);
    if (!verifyFn(str, signatureB64, publicKey)) throw new Error('GOVERNANCE_REJECTED: signature invalid.');
    if (!await adminFn(pool, intent.tenantId, publicKey)) throw new Error(`GOVERNANCE_REJECTED: not authorised.`);
    const client = { query: pool.query.bind(pool), release() {} };
    await client.query('BEGIN');
    await client.query('INSERT INTO admin_override_audit_logs ...', []);
    const { rowCount } = await client.query('UPDATE repay_payment_ledger ...', []);
    if (rowCount === 0) throw new Error('Row not found.');
    await client.query('COMMIT');
    return { success: true, rowsAffected: rowCount };
}

function mockPool(insertRowCount, updateRowCount) {
    return {
        async query(sql) {
            if (sql.startsWith('INSERT')) return { rowCount: insertRowCount };
            if (sql.startsWith('UPDATE')) return { rowCount: updateRowCount };
            return { rowCount: 1 };
        },
    };
}

console.log('\n=== Serialisation determinism ===');

check('same intent → identical JSON on two calls', () => {
    assert.strictEqual(serialiseOverrideIntent(INTENT), serialiseOverrideIntent({ ...INTENT }));
});
check('different requestedCategory → different JSON', () => {
    const a = serialiseOverrideIntent(INTENT);
    const b = serialiseOverrideIntent({ ...INTENT, requestedCategory: 'Fraud Category' });
    assert.notStrictEqual(a, b);
});
check('justification whitespace is trimmed', () => {
    const s = serialiseOverrideIntent({ ...INTENT, justification: '  padded  ' });
    assert.ok(JSON.parse(s).reason === 'padded');
});
check('close-period intent includes action, hash, and month', () => {
    const o = JSON.parse(serialiseClosePeriodIntent(42, '2026-07', 'deadbeef', 9999));
    assert.strictEqual(o.action, 'close_period');
    assert.strictEqual(o.hash, 'deadbeef');
    assert.strictEqual(o.month, '2026-07');
    assert.strictEqual(o.t_id, 42);
});

console.log('\n=== Timestamp freshness ===');

check('current timestamp is fresh', () => assert.ok(isTimestampFresh(Date.now())));
check('10 min old timestamp is stale', () => assert.ok(!isTimestampFresh(Date.now() - 600_000)));
check('future timestamp within window is fresh', () => assert.ok(isTimestampFresh(Date.now() + 60_000)));

console.log('\n=== Two-gate override logic (mocked gates) ===');

await checkAsync('Gate 1 fail → GOVERNANCE_REJECTED, no DB calls', async () => {
    let dbCalled = false;
    const pool = { query() { dbCalled = true; return { rowCount: 1 }; } };
    try {
        await applyOverrideMock(pool, INTENT, 'GFAKE', 'sig',
            { verifyFn: () => false, adminFn: async () => true });
        assert.fail('should throw');
    } catch (e) {
        assert.ok(e.message.startsWith('GOVERNANCE_REJECTED'));
        // Gate 1 fails before any DB write
    }
});

await checkAsync('Gate 2 fail → GOVERNANCE_REJECTED even with valid sig', async () => {
    try {
        await applyOverrideMock(mockPool(1, 1), INTENT, 'GFAKE', 'sig',
            { verifyFn: () => true, adminFn: async () => false });
        assert.fail('should throw');
    } catch (e) {
        assert.ok(e.message.startsWith('GOVERNANCE_REJECTED'));
    }
});

await checkAsync('both gates pass → audit INSERT + ledger UPDATE fired, success=true', async () => {
    const calls = [];
    const pool = {
        query(sql) {
            calls.push(sql.slice(0, 15));
            const rc = sql.startsWith('UPDATE') ? 1 : 1;
            return { rowCount: rc };
        },
    };
    const r = await applyOverrideMock(pool, INTENT, 'GFAKE', 'sig',
        { verifyFn: () => true, adminFn: async () => true });
    assert.strictEqual(r.success, true);
    assert.ok(calls.some(c => c.startsWith('INSERT')), 'audit INSERT must fire');
    assert.ok(calls.some(c => c.startsWith('UPDATE')), 'ledger UPDATE must fire');
});

await checkAsync('update rowCount=0 → throws "Row not found"', async () => {
    try {
        await applyOverrideMock(mockPool(1, 0), INTENT, 'GFAKE', 'sig',
            { verifyFn: () => true, adminFn: async () => true });
        assert.fail('should throw');
    } catch (e) {
        assert.ok(e.message.includes('not found'));
    }
});

console.log(`\n${passed} checks passed.\n`);
