// frontend/src/lib/governance.ts
// ---------------------------------------------------------------------------
// Freighter wallet integration + governance API calls.
// Uses @stellar/freighter-api v3+ for signMessage (arbitrary message signing).
// Falls back gracefully if Freighter is not installed.
// ---------------------------------------------------------------------------

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ---- Canonical serialisation (must match governance-pure.js exactly) ------
export interface OverrideIntent {
    tenantId:          number;
    transactionId:     number;    // ledger_row_id (numeric DB id)
    originalCategory:  string;
    requestedCategory: string;
    justification:     string;
    timestamp:         number;
}

export function serialiseOverrideIntent(intent: OverrideIntent): string {
    return JSON.stringify({
        t_id:     intent.tenantId,
        tx_id:    intent.transactionId,
        orig_cat: intent.originalCategory,
        req_cat:  intent.requestedCategory,
        reason:   intent.justification.trim(),
        time:     intent.timestamp,
    });
}

export function serialiseClosePeriodIntent(tenantId: number, monthKey: string, fingerprintHex: string, timestamp: number): string {
    return JSON.stringify({
        action: 'close_period',
        t_id:   tenantId,
        month:  monthKey,
        hash:   fingerprintHex,
        time:   timestamp,
    });
}

// ---- Freighter helpers ----------------------------------------------------
export async function freighterAvailable(): Promise<boolean> {
    try {
        const { isConnected } = await import('@stellar/freighter-api');
        return (await isConnected()).isConnected;
    } catch { return false; }
}

export async function connectWallet(): Promise<string> {
    const { requestAccess, getPublicKey } = await import('@stellar/freighter-api');
    const accessResult = await requestAccess();
    if (accessResult.error) throw new Error(accessResult.error);
    const pkResult = await getPublicKey();
    if (pkResult.error) throw new Error(pkResult.error);
    return pkResult.publicKey;
}

async function signMessage(message: string): Promise<{ signature: string; publicKey: string }> {
    const { signMessage: fSign, getPublicKey } = await import('@stellar/freighter-api');
    const pkResult = await getPublicKey();
    if (pkResult.error) throw new Error(pkResult.error);
    const signResult = await fSign(message, pkResult.publicKey);
    if (signResult.error) throw new Error(signResult.error);
    // signedMessage is a base64-encoded raw ed25519 signature
    return { signature: signResult.signedMessage, publicKey: pkResult.publicKey };
}

// ---- API calls -----------------------------------------------------------
export async function checkAdminStatus(tenantId: number, publicKey: string): Promise<boolean> {
    const r = await fetch(`${API}/api/governance/admin-status?tenantId=${tenantId}&publicKey=${encodeURIComponent(publicKey)}`);
    if (!r.ok) return false;
    const data = await r.json();
    return data.authorised === true;
}

export async function submitOverride(intent: OverrideIntent): Promise<{ success: boolean }> {
    const intentWithTs = { ...intent, timestamp: Date.now() };
    const intentStr    = serialiseOverrideIntent(intentWithTs);
    const { signature, publicKey } = await signMessage(intentStr);
    const r = await fetch(`${API}/api/governance/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: intentWithTs, publicKey, signature }),
    });
    if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Override failed');
    }
    return r.json();
}

export async function submitClosePeriod(tenantId: number, monthKey: string): Promise<{
    success: boolean; stellarTxHash: string; fingerprintHex: string; ledger: number;
}> {
    // Timestamp is included in the signed payload so the admin commits to a specific moment.
    const timestamp   = Date.now();
    // The fingerprint is computed server-side; we sign a "request to close" intent.
    // The server will compute the actual fingerprint, include it, and verify nothing drifted.
    const intentStr   = serialiseClosePeriodIntent(tenantId, monthKey, 'pending', timestamp);
    const { signature, publicKey } = await signMessage(intentStr);
    const r = await fetch(`${API}/api/governance/close-period`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, monthKey, publicKey, signature }),
    });
    if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Close-of-Period failed');
    }
    return r.json();
}

export async function getAuditLog(tenantId: number): Promise<{ rows: AuditRow[]; total: number }> {
    const r = await fetch(`${API}/api/governance/audit-log?tenantId=${tenantId}`);
    if (!r.ok) throw new Error('Failed to fetch audit log');
    return r.json();
}

export interface AuditRow {
    id:                number;
    ledger_row_id:     number;
    admin_address:     string;
    previous_category: string;
    new_category:      string;
    created_at:        string;
    payment_number:    string;
    vendor_name:       string;
}
