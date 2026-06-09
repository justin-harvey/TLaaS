// indexer/indexer.js
// ---------------------------------------------------------------------------
// Phase 4 — Stellar anchor event poller and decode layer.
// DB logic (recomputeAndVerify, recordAnchor) lives in indexer-db.js so those
// pure functions stay unit-testable without the Stellar SDK installed.
// ---------------------------------------------------------------------------
import { rpc, scValToNative } from '@stellar/stellar-sdk';
import pg from 'pg';
import 'dotenv/config';
import { recomputeAndVerify, recordAnchor } from './indexer-db.js';

const CONTRACT_ID = process.env.SOROBAN_LEDGER_CONTRACT_ID;
const LOOKBACK    = Number(process.env.INDEXER_LOOKBACK  || 100);
const POLL_MS     = Number(process.env.INDEXER_POLL_MS   || 5000);

export function decodeAnchorEvent(event) {
    const topic = scValToNative(event.topic[0]);
    if (topic !== 'anchor') return null;
    // Event value tuple: (tenant_id: u32, month_key: String, ipfs_cid: String, data_hash: BytesN<32>)
    const [tenantId, monthKey, ipfsCid, hashBytes] = scValToNative(event.value);
    return {
        tenantId,
        monthKey,
        ipfsCid,
        hashHex: Buffer.from(hashBytes).toString('hex'),
        txHash:  event.txHash || event.id,
    };
}

export async function handleEvent(pool, event) {
    const d = decodeAnchorEvent(event);
    if (!d) return null;
    const verified = await recomputeAndVerify(pool, d.tenantId, d.monthKey, d.hashHex);
    return recordAnchor(pool, d, verified);
}

export async function runOnce(pool, server) {
    const latest = await server.getLatestLedger();
    const startLedger = Math.max(1, latest.sequence - LOOKBACK);
    const res = await server.getEvents({
        startLedger,
        filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }],
        limit: 100,
    });
    const handled = [];
    for (const ev of res.events || []) {
        const r = await handleEvent(pool, ev);
        if (r) handled.push(r);
    }
    return handled;
}

// Guard: only start the polling loop when run directly.
if (process.argv[1]?.endsWith('indexer.js')) {
    const server = new rpc.Server(process.env.STELLAR_RPC_URL);
    const pool   = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    console.log(`Indexer listening on contract ${CONTRACT_ID} (lookback ${LOOKBACK} ledgers, poll ${POLL_MS}ms).`);
    async function loop() {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try { await runOnce(pool, server); }
            catch (e) { console.error('Indexer poll error:', e.message); }
            await new Promise((r) => setTimeout(r, POLL_MS));
        }
    }
    loop().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
}
