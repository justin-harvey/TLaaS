// validator/stellar-broadcast.js
// ---------------------------------------------------------------------------
// Bridges the validator's deterministic fingerprint to the Soroban anchor
// contract. Called ONLY on a Close-of-Period action (Phase 6) — never per row.
//
// Two functions:
//   anchorHashToStellar(...) -> signs as the instance admin and writes on-chain
//   getAnchorRecord(...)     -> read-only simulate, used by verify + reconcile
// ---------------------------------------------------------------------------
import {
    rpc, Keypair, Contract, TransactionBuilder, nativeToScVal, scValToNative,
} from '@stellar/stellar-sdk';
import 'dotenv/config';

const server = new rpc.Server(process.env.STELLAR_RPC_URL);
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE;
const contractId = process.env.SOROBAN_LEDGER_CONTRACT_ID;

function serverKeypair() {
    return Keypair.fromSecret(process.env.SERVER_SECRET_KEY); // must be the instance admin
}

function anchorArgs(tenantId, monthKey, ipfsCid, dataHexHash) {
    const hashBuffer = Buffer.from(dataHexHash, 'hex');
    if (hashBuffer.length !== 32) {
        throw new Error(`data_hash must be exactly 32 bytes (got ${hashBuffer.length}).`);
    }
    return [
        nativeToScVal(tenantId, { type: 'u32' }),
        nativeToScVal(monthKey, { type: 'string' }),
        nativeToScVal(ipfsCid, { type: 'string' }),
        nativeToScVal(hashBuffer, { type: 'bytes' }), // BytesN<32>
    ];
}

/**
 * Anchor a settled period on-chain.
 * @returns {{ hash: string, ledger: number }} the Stellar transaction hash + ledger
 */
export async function anchorHashToStellar(tenantId, monthKey, ipfsCid, dataHexHash) {
    const kp = serverKeypair();
    const contract = new Contract(contractId);
    const account = await server.getAccount(kp.publicKey());

    let tx = new TransactionBuilder(account, {
        fee: '1000000', // generous buffer; real cost is a fraction of a cent
        networkPassphrase,
    })
        .addOperation(contract.call('anchor_record', ...anchorArgs(tenantId, monthKey, ipfsCid, dataHexHash)))
        .setTimeout(60)
        .build();

    // Simulate + assemble (computes resource fees / footprint), then sign + send.
    tx = await server.prepareTransaction(tx);
    tx.sign(kp);

    const sent = await server.sendTransaction(tx);
    if (sent.status === 'ERROR') {
        throw new Error(`Submission failed: ${JSON.stringify(sent.errorResult ?? sent)}`);
    }

    // Poll until the network confirms.
    let res = await server.getTransaction(sent.hash);
    while (res.status === 'NOT_FOUND') {
        await new Promise((r) => setTimeout(r, 1000));
        res = await server.getTransaction(sent.hash);
    }
    if (res.status !== 'SUCCESS') {
        throw new Error(`Anchor not successful: ${res.status} (likely AlreadyAnchored).`);
    }
    return { hash: sent.hash, ledger: res.ledger };
}

/**
 * Read an anchor record without spending fees (read-only simulation).
 * @returns {{ ipfs_cid: string, data_hash: string } | null}
 */
export async function getAnchorRecord(tenantId, monthKey) {
    const contract = new Contract(contractId);
    // A funded source is only needed to build the envelope; no fee is paid on simulate.
    const kp = serverKeypair();
    const account = await server.getAccount(kp.publicKey());

    const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase })
        .addOperation(contract.call('get_anchor_record',
            nativeToScVal(tenantId, { type: 'u32' }),
            nativeToScVal(monthKey, { type: 'string' })))
        .setTimeout(30)
        .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) return null;

    const native = scValToNative(sim.result.retval); // contract returns Option<AnchorRecord>
    if (!native) return null;
    // AnchorRecord struct -> { ipfs_cid, data_hash(Buffer) }
    return {
        ipfs_cid: native.ipfs_cid,
        data_hash: Buffer.from(native.data_hash).toString('hex'),
    };
}
