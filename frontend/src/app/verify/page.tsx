'use client';
import React, { useState } from 'react';
import { Shield, CheckCircle2, XCircle, HelpCircle, RefreshCw } from 'lucide-react';
import { Card, Badge, Button, HashChip, Input } from '@/components/cc';
import { verifyRecord } from '@/lib/api';
import { fmtDate } from '@/lib/utils';
import type { VerifyResponse } from '@/types';

type Status = 'idle' | 'loading' | 'match' | 'mismatch' | 'error';

export default function VerifyPage() {
  const [txId, setTxId]       = useState('');
  const [status, setStatus]   = useState<Status>('idle');
  const [result, setResult]   = useState<VerifyResponse | null>(null);
  const [errMsg, setErrMsg]   = useState('');

  const runVerify = async () => {
    if (!txId.trim()) return;
    setStatus('loading'); setResult(null); setErrMsg('');
    try {
      const r = await verifyRecord(txId.trim());
      setResult(r);
      setStatus(r.match ? 'match' : 'mismatch');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Verification failed');
      setStatus('error');
    }
  };

  return (
    <div className="max-w-[820px] mx-auto space-y-6">
      <div>
        <p className="type-label mb-1">Integrity check</p>
        <h1 className="type-h1">Blockchain Verification</h1>
        <p className="text-[14px] text-muted mt-1.5">Verify a payment record by comparing its off-chain SHA-256 fingerprint against the on-chain anchor. Any tampering changes the fingerprint.</p>
      </div>

      {/* Input */}
      <Card eyebrow="Verify by ID" title="Enter Transaction">
        <div className="flex gap-3">
          <Input mono placeholder="TX-480112 or enter a transaction ID" value={txId}
            onChange={e => setTxId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runVerify()} wrapStyle={{ flex: 1 }} />
          <Button onClick={runVerify} disabled={!txId.trim() || status === 'loading'}
            icon={status === 'loading' ? <RefreshCw size={13} className="animate-spin" /> : <Shield size={13} />}>
            {status === 'loading' ? 'Verifying…' : 'Verify'}
          </Button>
        </div>
        {/* Quick examples */}
        <div className="flex flex-wrap gap-2 mt-3">
          <p className="type-label self-center">Try:</p>
          {['TX-480112', 'TX-480114', 'TX-480119'].map(id => (
            <button key={id} onClick={() => setTxId(id)}
              className="text-[12px] font-mono text-blue-500 hover:text-blue-700 border border-blue-300/60 rounded-xs px-2 py-0.5 bg-[#DCE6F2]/40 transition-colors">
              {id}
            </button>
          ))}
        </div>
      </Card>

      {/* Result */}
      {status === 'error' && (
        <Card>
          <div className="flex items-center gap-3 text-[#A8483A]">
            <XCircle size={20} />
            <span className="font-medium">{errMsg}</span>
          </div>
        </Card>
      )}

      {result && (
        <div className="space-y-4 cc-fade-in">
          {/* Verdict banner */}
          <div className={`flex items-center gap-4 p-4 rounded-md border ${result.match ? 'bg-[#E2E8DA] border-[#5F7E5A]/40' : 'bg-[#F0DCD5] border-[#A8483A]/40'}`}>
            {result.match
              ? <CheckCircle2 size={28} className="text-[#5F7E5A] flex-shrink-0" />
              : <XCircle     size={28} className="text-[#A8483A] flex-shrink-0" />}
            <div>
              <p className={`text-[17px] font-semibold ${result.match ? 'text-[#3A5436]' : 'text-[#7A3228]'}`}>
                {result.match ? 'Record verified. Fingerprints match.' : 'Integrity failure. Fingerprints do not match.'}
              </p>
              <p className="text-[13px] text-muted mt-0.5">
                {result.match
                  ? 'The off-chain cache hash matches the on-chain anchor. This record has not been tampered with.'
                  : 'The cache hash differs from what was anchored on-chain. This record may have been altered.'}
              </p>
            </div>
          </div>

          {/* Hash comparison */}
          <div className="grid grid-cols-2 gap-4">
            <Card eyebrow="Off-chain cache" title="Computed fingerprint" accent="var(--chart-3)">
              <div className="space-y-3">
                <HashChip label="SHA-256" value={result.cacheHash} chars={8} tone="info" />
                <p className="text-[12px] text-muted">Recomputed from Postgres cache rows via the canonical sort + projection.</p>
              </div>
            </Card>

            <Card eyebrow="On-chain anchor" title="Ledger fingerprint" accent={result.match ? 'var(--chart-3)' : 'var(--chart-4)'}>
              <div className="space-y-3">
                <HashChip label="SHA-256" value={result.ledgerHash} chars={8} tone={result.match ? 'anchored' : 'spike'} />
                <p className="text-[12px] text-muted">Read via <code className="font-mono text-[11px]">get_anchor_record</code> — immutable once anchored.</p>
              </div>
            </Card>
          </div>

          {/* Chain details */}
          <Card eyebrow="Chain record" title="Ledger transaction">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="type-label mb-1">Transaction</p>
                <HashChip label="tx" value={result.ledgerTx} chars={8} tone="anchored"
                  href={`https://testnet.stellarchain.io/transactions/${result.ledgerTx}`} />
              </div>
              <div>
                <p className="type-label mb-1">Block / Ledger</p>
                <span className="font-mono text-[14px] text-ink tabular-nums">{result.block.toLocaleString()}</span>
              </div>
              <div>
                <p className="type-label mb-1">Anchored at</p>
                <span className="text-[14px] text-ink-soft">{fmtDate(result.timestamp)}</span>
              </div>
              <div>
                <p className="type-label mb-1">Status</p>
                <Badge tone={result.match ? 'anchored' : 'spike'} dot>{result.match ? 'Verified' : 'Tampered'}</Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Explainer */}
      {status === 'idle' && (
        <Card eyebrow="How this works" title="The verification protocol" accent="var(--chart-1)">
          <div className="space-y-3 text-[13px] text-muted">
            {[
              ['Ingest', 'When payments arrive, the validator runs them through a 3-tier circuit breaker, tags by MCC, and computes a deterministic SHA-256 fingerprint (sorted rows, canonical projection).'],
              ['Close-of-Period', 'A manager signs off on a month, triggering anchor_record on the Stellar/Soroban contract. The fingerprint + IPFS CID are written on-chain — immutable.'],
              ['Verify', 'This tool recomputes the fingerprint from the live cache and reads get_anchor_record. If they match, the data is untampered. If not, something changed after anchoring.'],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-3">
                <HelpCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p><strong className="text-ink">{title}.</strong> {body}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
