'use client';
import React, { useState, useEffect } from 'react';
import { Wallet, ShieldCheck, ShieldOff, Lock, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button, Badge, Card, HashChip } from '@/components/cc';
import {
    freighterAvailable, connectWallet, checkAdminStatus,
    submitOverride, submitClosePeriod, getAuditLog,
    type AuditRow,
} from '@/lib/governance';
import { truncHash, fmtDate } from '@/lib/utils';

const CATEGORIES = [
    'Inventory Sourcing', 'Shop Tools & Battery Supplies', 'Shipping Logistics',
    'General Operating Costs', 'Facilities Overhead', 'IT Overhead',
    'Employee Wellness', 'Regulatory Licensing', 'Office Administration',
    'Fuel', 'Supplies', 'Services', 'Equipment', 'Utilities',
];

// ---- Panel props ----------------------------------------------------------
interface GovernancePanelProps {
    tenantId:   number;
    /** DB ledger_row_id of the selected transaction (numeric, NOT payment_number) */
    rowId:      number;
    vendor:     string;
    currentCategory: string;
    monthKey:   string;   // 'YYYY-MM' — determines Close-of-Period scope
    onOverrideSuccess?: () => void;
}

type WalletState = 'idle' | 'connecting' | 'checking' | 'admin' | 'not-admin' | 'no-wallet';
type CloseState  = 'idle' | 'confirming' | 'anchoring' | 'done' | 'error';

export function GovernancePanel({ tenantId, rowId, vendor, currentCategory, monthKey, onOverrideSuccess }: GovernancePanelProps) {
    const [wallet, setWallet]   = useState<WalletState>('idle');
    const [pubKey, setPubKey]   = useState('');
    const [newCat, setNewCat]   = useState(currentCategory);
    const [justification, setJ] = useState('');
    const [overrideState, setOS]= useState<'idle'|'signing'|'done'|'error'>('idle');
    const [overrideMsg, setOM]  = useState('');
    const [closeState, setCS]   = useState<CloseState>('idle');
    const [closeTx, setCTx]     = useState('');
    const [closeErr, setCErr]   = useState('');
    const [auditLog, setAL]     = useState<AuditRow[]>([]);
    const [showAudit, setSA]    = useState(false);

    // ---- Wallet connect ----------------------------------------------------
    const connect = async () => {
        setWallet('connecting');
        const available = await freighterAvailable();
        if (!available) { setWallet('no-wallet'); return; }
        try {
            const pk = await connectWallet();
            setPubKey(pk);
            setWallet('checking');
            const ok = await checkAdminStatus(tenantId, pk);
            setWallet(ok ? 'admin' : 'not-admin');
        } catch (e) {
            setWallet('idle');
            console.error(e);
        }
    };

    // ---- Category override -------------------------------------------------
    const applyOverride = async () => {
        if (!justification.trim() || newCat === currentCategory) return;
        setOS('signing'); setOM('');
        try {
            await submitOverride({
                tenantId, transactionId: rowId,
                originalCategory: currentCategory,
                requestedCategory: newCat,
                justification, timestamp: Date.now(),
            });
            setOS('done'); setOM('Override applied and audit trail logged.');
            onOverrideSuccess?.();
        } catch (e) {
            setOS('error'); setOM(e instanceof Error ? e.message : 'Override failed.');
        }
    };

    // ---- Close-of-Period --------------------------------------------------
    const closePeriod = async () => {
        setCS('anchoring'); setCErr('');
        try {
            const r = await submitClosePeriod(tenantId, monthKey);
            setCTx(r.stellarTxHash);
            setCS('done');
        } catch (e) {
            setCErr(e instanceof Error ? e.message : 'Anchor failed.');
            setCS('error');
        }
    };

    // ---- Audit log --------------------------------------------------------
    useEffect(() => {
        if (showAudit && wallet === 'admin') {
            getAuditLog(tenantId).then(r => setAL(r.rows)).catch(() => {});
        }
    }, [showAudit, wallet, tenantId]);

    // ---- Render -----------------------------------------------------------
    return (
        <div className="border-t border-[#DDD3BE] mt-4 pt-4 space-y-4">
            <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-blue-600" />
                <p className="type-label">Governance controls</p>
            </div>

            {/* Wallet states */}
            {wallet === 'idle' && (
                <Button size="sm" variant="secondary" icon={<Wallet size={13} />} onClick={connect}>
                    Connect admin wallet
                </Button>
            )}
            {wallet === 'connecting' && <p className="text-[12px] text-muted animate-pulse">Opening Freighter…</p>}
            {wallet === 'checking' && <p className="text-[12px] text-muted animate-pulse">Verifying admin registry…</p>}
            {wallet === 'no-wallet' && (
                <div className="flex items-center gap-2 text-[12px] text-[#A8483A]">
                    <ShieldOff size={13} />
                    Freighter wallet extension required.{' '}
                    <a href="https://www.freighter.app" target="_blank" rel="noopener" className="underline">Install</a>
                </div>
            )}
            {wallet === 'not-admin' && (
                <div className="flex items-center gap-2 text-[12px] text-[#A8483A]">
                    <ShieldOff size={13} />
                    <span>{truncHash(pubKey)} is not a registered admin for this tenant.</span>
                </div>
            )}

            {/* Admin panel */}
            {wallet === 'admin' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[12px] text-[#3A5436]">
                        <ShieldCheck size={13} />
                        <span className="font-medium">Admin verified</span>
                        <HashChip value={pubKey} chars={4} tone="anchored" />
                    </div>

                    {/* Category override */}
                    <div className="space-y-2">
                        <p className="type-label">Reclassify transaction</p>
                        <select value={newCat} onChange={e => setNewCat(e.target.value)}
                            className="w-full h-8 px-3 text-sm bg-[#FBF7EE] border border-[#DDD3BE] rounded-xs text-ink focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20">
                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                        <textarea value={justification} onChange={e => setJ(e.target.value)}
                            placeholder="Justification (required) — this text is signed and immutably logged."
                            rows={2}
                            className="w-full px-3 py-2 text-sm bg-[#FBF7EE] border border-[#DDD3BE] rounded-xs text-ink placeholder-muted resize-none focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20" />
                        <Button size="sm" full
                            disabled={newCat === currentCategory || !justification.trim() || overrideState === 'signing'}
                            icon={overrideState === 'signing' ? <RefreshCw size={12} className="animate-spin" /> : <Lock size={12} />}
                            onClick={applyOverride}>
                            {overrideState === 'signing' ? 'Signing with Freighter…' : 'Override with signature'}
                        </Button>
                        {overrideState === 'done' && (
                            <div className="flex items-center gap-1.5 text-[12px] text-[#3A5436]">
                                <CheckCircle2 size={12} /> {overrideMsg}
                            </div>
                        )}
                        {overrideState === 'error' && (
                            <p className="text-[12px] text-[#A8483A]">{overrideMsg}</p>
                        )}
                    </div>

                    {/* Close-of-Period */}
                    <div className="space-y-2 pt-3 border-t border-[#DDD3BE]">
                        <p className="type-label">Close of period</p>
                        <p className="text-[12px] text-muted">
                            Anchor the {monthKey} settlement fingerprint on-chain. This is irreversible.
                        </p>
                        {closeState === 'idle' && (
                            <Button size="sm" full variant="secondary" icon={<Lock size={12} />}
                                onClick={() => setCS('confirming')}>
                                Close {monthKey}…
                            </Button>
                        )}
                        {closeState === 'confirming' && (
                            <div className="p-3 bg-[#F0E6CF] border border-[#B8862B]/30 rounded-xs space-y-2">
                                <p className="text-[12px] font-semibold text-ink">
                                    Confirm: anchor all {monthKey} records on-chain?
                                </p>
                                <p className="text-[11px] text-muted">
                                    Your Freighter wallet will prompt you to sign the close intent. The fingerprint will be written to the Soroban contract and cannot be overwritten.
                                </p>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={closePeriod}>Confirm and anchor</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setCS('idle')}>Cancel</Button>
                                </div>
                            </div>
                        )}
                        {closeState === 'anchoring' && (
                            <p className="text-[12px] text-muted animate-pulse flex items-center gap-1.5">
                                <RefreshCw size={11} className="animate-spin" /> Signing and anchoring…
                            </p>
                        )}
                        {closeState === 'done' && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-[12px] text-[#3A5436]">
                                    <CheckCircle2 size={12} /> Period anchored on-chain.
                                </div>
                                <HashChip label="stellar_tx" value={closeTx} chars={8} tone="anchored"
                                    href={`https://testnet.stellarchain.io/transactions/${closeTx}`} />
                            </div>
                        )}
                        {closeState === 'error' && (
                            <p className="text-[12px] text-[#A8483A] flex items-center gap-1.5">
                                <AlertTriangle size={12} /> {closeErr}
                            </p>
                        )}
                    </div>

                    {/* Audit log toggle */}
                    <div className="pt-2 border-t border-[#DDD3BE]">
                        <button onClick={() => setSA(v => !v)}
                            className="type-label hover:text-ink transition-colors">
                            {showAudit ? '▾ Hide' : '▸ View'} audit log ({auditLog.length} entries)
                        </button>
                        {showAudit && auditLog.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                                {auditLog.slice(0, 5).map(a => (
                                    <div key={a.id} className="text-[11px] text-muted border border-[#DDD3BE] rounded-xs px-3 py-2 bg-[#FBF7EE]">
                                        <span className="font-medium text-ink">{a.vendor_name}</span>
                                        {' '}{a.previous_category} → <span className="font-medium">{a.new_category}</span>
                                        <span className="block opacity-60">{fmtDate(a.created_at)} · {truncHash(a.admin_address)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
