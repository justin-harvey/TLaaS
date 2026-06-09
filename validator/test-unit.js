// validator/test-unit.js
// ---------------------------------------------------------------------------
// DB-free tests: circuit-breaker tiers + fingerprint determinism.
// Run anywhere:  node test-unit.js   (no Postgres, no deps needed)
// ---------------------------------------------------------------------------
import assert from 'assert';
import * as fs from 'fs';
import { IngestionCircuitBreaker } from './circuit-breaker.js';
import { buildSanitizedRow, computeFingerprint } from './fingerprint.js';

let passed = 0;
function check(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}

console.log('\n=== Circuit breaker ===');

check('clean automotive payload passes', () => {
    const raw = fs.readFileSync('./samples/clean_plaid.json', 'utf8');
    const r = new IngestionCircuitBreaker('t1', 'automotive').validate(raw);
    assert.strictEqual(r.ok, true, 'expected ok=true');
    assert.strictEqual(r.transactions.length, 3);
});

check('corrupted payload trips the breaker', () => {
    const raw = fs.readFileSync('./samples/corrupted_plaid.json', 'utf8');
    const r = new IngestionCircuitBreaker('t1', 'automotive').validate(raw);
    assert.strictEqual(r.ok, false, 'expected ok=false');
});

check('corrupted payload flags negative amount, empty merchant, bad mcc, bad date, dup id', () => {
    const raw = fs.readFileSync('./samples/corrupted_plaid.json', 'utf8');
    const r = new IngestionCircuitBreaker('t1', 'automotive').validate(raw);
    const fields = new Set(r.errors.map(e => e.field));
    for (const f of ['amount', 'raw_merchant', 'mcc_code', 'date', 'transaction_id']) {
        assert.ok(fields.has(f), `expected an error on field "${f}"`);
    }
});

check('industry ceiling is respected (8e8 ok for utilities? no — still > 20M)', () => {
    const tx = JSON.stringify([{ transaction_id: 'x', raw_merchant: 'M', mcc_code: 4900, amount: 25_000_000, date: '2026-06-01' }]);
    const auto = new IngestionCircuitBreaker('t', 'automotive').validate(tx);   // ceiling 500k -> fail
    const util = new IngestionCircuitBreaker('t', 'utilities').validate(tx);    // ceiling 20M  -> fail (25M>20M)
    assert.strictEqual(auto.ok, false);
    assert.strictEqual(util.ok, false);
    const utilOk = new IngestionCircuitBreaker('t', 'utilities').validate(
        JSON.stringify([{ transaction_id: 'y', raw_merchant: 'M', mcc_code: 4900, amount: 19_000_000, date: '2026-06-01' }]));
    assert.strictEqual(utilOk.ok, true, '19M should pass the 20M utilities ceiling');
});

check('empty array is rejected', () => {
    const r = new IngestionCircuitBreaker('t', 'automotive').validate('[]');
    assert.strictEqual(r.ok, false);
});

check('non-JSON is rejected', () => {
    const r = new IngestionCircuitBreaker('t', 'automotive').validate('{not json');
    assert.strictEqual(r.ok, false);
});

console.log('\n=== Fingerprint determinism ===');

const rowsA = [
    buildSanitizedRow({ date: '2026-06-05', merchant: 'ACME', mcc: 5072, category: 'Shop Tools & Equipment', amount: 640.1 }),
    buildSanitizedRow({ date: '2026-06-03', merchant: 'MIDWEST', mcc: 5533, category: 'Inventory Sourcing', amount: 4250 }),
    buildSanitizedRow({ date: '2026-06-04', merchant: 'GRID', mcc: 4900, category: 'Facilities Overhead', amount: 1820.55 }),
];

check('same rows -> same hash across runs', () => {
    assert.strictEqual(computeFingerprint(rowsA), computeFingerprint(rowsA));
});

check('shuffled row order -> identical hash', () => {
    const shuffled = [rowsA[2], rowsA[0], rowsA[1]];
    assert.strictEqual(computeFingerprint(rowsA), computeFingerprint(shuffled));
});

check('changing one cent -> different hash (tamper detection)', () => {
    const tampered = rowsA.map((r, i) => i === 1 ? { ...r, amount: 4250.01 } : r);
    assert.notStrictEqual(computeFingerprint(rowsA), computeFingerprint(tampered));
});

console.log(`\n${passed} checks passed.\n`);
