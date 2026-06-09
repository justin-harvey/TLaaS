// validator/test-repay-unit.js
// DB-free RePay tests. Run anywhere: node test-repay-unit.js
import assert from 'assert';
import * as fs from 'fs';
import { RepayCircuitBreaker } from './repay-circuit-breaker.js';
import { parseMoney, normalizeType, splitInvoices, parseRepayDate } from './parse.js';

let passed = 0;
function check(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}

console.log('\n=== Parse helpers ===');
check('parseMoney strips $ and commas', () => {
    assert.strictEqual(parseMoney('$1,146.36'), 1146.36);
    assert.strictEqual(parseMoney('$235.00'), 235);
    assert.strictEqual(parseMoney(776.17), 776.17);
});
check('normalizeType maps export abbreviations', () => {
    assert.strictEqual(normalizeType('VCard'), 'VirtualCard');
    assert.strictEqual(normalizeType('Check'), 'Check/Cheque');
    assert.strictEqual(normalizeType('ACH'), 'ACH');
    assert.strictEqual(normalizeType('Mystery'), 'Mystery'); // unknown passes through
});
check('splitInvoices handles comma string, newline string, and array', () => {
    assert.deepStrictEqual(splitInvoices('AS1, AS2, AS3'), ['AS1', 'AS2', 'AS3']);
    assert.deepStrictEqual(splitInvoices('222797\n222619'), ['222797', '222619']);
    assert.deepStrictEqual(splitInvoices(['X', 'Y']), ['X', 'Y']);
});
check('parseRepayDate handles RePay timestamp', () => {
    assert.strictEqual(parseRepayDate('6/03/2026, 12:17:35 PM'), '2026-06-03');
    assert.strictEqual(parseRepayDate('NOT_A_DATE'), null);
});

console.log('\n=== RePay circuit breaker (real screenshot fixture) ===');
check('clean 7-row screenshot export passes', () => {
    const raw = fs.readFileSync('./samples/clean_repay.json', 'utf8');
    const r = new RepayCircuitBreaker('demo', 'automotive').validate(raw);
    assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
    assert.strictEqual(r.rows.length, 7);
});
check('corrupted export trips breaker on amount, vendor, type, date, dup', () => {
    const raw = fs.readFileSync('./samples/corrupted_repay.json', 'utf8');
    const r = new RepayCircuitBreaker('demo', 'automotive').validate(raw);
    assert.strictEqual(r.ok, false);
    const fields = new Set(r.errors.map((e) => e.field));
    for (const f of ['total_amount', 'vendor_name', 'payment_type', 'creation_date', 'payment_number']) {
        assert.ok(fields.has(f), `expected error on "${f}"`);
    }
});
check('no MCC required (RePay rows have none)', () => {
    const raw = fs.readFileSync('./samples/clean_repay.json', 'utf8');
    const r = new RepayCircuitBreaker('demo', 'automotive').validate(raw);
    const mccErrors = r.errors.filter((e) => e.field === 'mcc_code' || e.field === 'mcc');
    assert.strictEqual(mccErrors.length, 0);
});

console.log(`\n${passed} checks passed.\n`);
