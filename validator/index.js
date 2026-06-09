// validator/index.js
// ---------------------------------------------------------------------------
// Orchestrator / circuit breaker entrypoint for the validator container.
//
// Two modes:
//   1. CLI one-shot:   node index.js <file.json> <tenantId> <industryType>
//   2. Dropzone scan:  node index.js            (processes ./drops/*.json)
//
// On pass  -> ingestPlaidPayload() writes to the cache + returns the fingerprint.
// On fail  -> the file is moved to ./quarantine with a sibling .errors.json report.
// ---------------------------------------------------------------------------
import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';
import { IngestionCircuitBreaker } from './circuit-breaker.js';
import { ingestPlaidPayload } from './pipeline.js';
import { RepayCircuitBreaker } from './repay-circuit-breaker.js';
import { ingestRepayPayload } from './repay-pipeline.js';

const DROP_DIR = process.env.DROP_DIR || './drops';
const QUARANTINE_DIR = process.env.QUARANTINE_DIR || './quarantine';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function quarantine(filePath, errors) {
    fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
    const base = path.basename(filePath);
    const dest = path.join(QUARANTINE_DIR, base);
    fs.copyFileSync(filePath, dest);
    fs.writeFileSync(dest.replace(/\.json$/, '') + '.errors.json',
        JSON.stringify({ file: base, quarantinedAt: new Date().toISOString(), errors }, null, 2));
    console.error(`⛔ Quarantined ${base} — ${errors.length} error(s). Report written.`);
}

async function processFile(filePath, tenantId, industryType, source = 'plaid') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const isRepay = String(source).toLowerCase() === 'repay';

    const breaker = isRepay
        ? new RepayCircuitBreaker(`tenant:${tenantId}`, industryType)
        : new IngestionCircuitBreaker(`tenant:${tenantId}`, industryType);
    const result = breaker.validate(raw);

    if (!result.ok) {
        quarantine(filePath, result.errors);
        return { ok: false, errors: result.errors };
    }

    const records = isRepay ? result.rows : result.transactions;
    const ingest = isRepay
        ? await ingestRepayPayload(pool, Number(tenantId), records)
        : await ingestPlaidPayload(pool, Number(tenantId), records);

    console.log(`✅ ${path.basename(filePath)} [${isRepay ? 'repay' : 'plaid'}] — ${ingest.rowsIngested} rows. Fingerprint: ${ingest.blockchainHash}`);
    return { ok: true, ...ingest };
}

async function main() {
    const [, , fileArg, tenantArg, industryArg, sourceArg] = process.argv;

    if (fileArg) {
        await processFile(fileArg, tenantArg, industryArg, sourceArg || 'plaid');
    } else {
        if (!fs.existsSync(DROP_DIR)) { console.log(`No dropzone at ${DROP_DIR}.`); return; }
        const files = fs.readdirSync(DROP_DIR).filter(f => f.endsWith('.json'));
        if (files.length === 0) { console.log('Dropzone empty.'); return; }
        // Convention: <tenantId>__<industry>__<source>__<name>.json   (source: plaid|repay)
        for (const f of files) {
            const [tenantId, industry, source] = f.split('__');
            await processFile(path.join(DROP_DIR, f), tenantId, industry, source);
        }
    }
    await pool.end();
}

main().catch(async (e) => { console.error('Fatal:', e.message); await pool.end(); process.exit(1); });
