// validator/governance-routes.js
// Express route handlers for Phase 6 governance endpoints.
// Mounted at /api/governance by server.js.
import { Router } from 'express';
import { applyOverride, closePeriod, isRegisteredAdmin } from './governance-service.js';

const router = Router();

// ---- GET /api/governance/admin-status ------------------------------------
// Check whether a Stellar public key is the registered admin for a tenant.
// Used by the frontend to unlock the governance panel after wallet connect.
router.get('/admin-status', async (req, res) => {
    const { tenantId, publicKey } = req.query;
    if (!tenantId || !publicKey) return res.status(400).json({ error: 'tenantId and publicKey required' });
    try {
        const authorised = await isRegisteredAdmin(req.pool, Number(tenantId), publicKey);
        res.json({ authorised, publicKey, tenantId: Number(tenantId) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- POST /api/governance/override ----------------------------------------
// Apply a signed category override.
// Body: { intent: OverrideIntent, publicKey: string, signature: string (base64) }
router.post('/override', async (req, res) => {
    const { intent, publicKey, signature } = req.body;
    if (!intent || !publicKey || !signature) {
        return res.status(400).json({ error: 'intent, publicKey, and signature are required' });
    }
    // Required intent fields
    const required = ['tenantId', 'transactionId', 'originalCategory', 'requestedCategory', 'justification', 'timestamp'];
    for (const k of required) {
        if (intent[k] == null) return res.status(400).json({ error: `Missing intent field: ${k}` });
    }
    // Timestamp freshness check (±5 min)
    if (Math.abs(Date.now() - intent.timestamp) > 300_000) {
        return res.status(400).json({ error: 'Intent timestamp expired. Re-sign and retry.' });
    }
    try {
        const result = await applyOverride(req.pool, intent, publicKey, signature);
        res.json(result);
    } catch (err) {
        const status = err.message.startsWith('GOVERNANCE_REJECTED') ? 403 : 500;
        res.status(status).json({ error: err.message });
    }
});

// ---- POST /api/governance/close-period ------------------------------------
// Recompute fingerprint and anchor the month on-chain.
// Body: { tenantId, monthKey, publicKey, signature }
router.post('/close-period', async (req, res) => {
    const { tenantId, monthKey, publicKey, signature } = req.body;
    if (!tenantId || !monthKey || !publicKey || !signature) {
        return res.status(400).json({ error: 'tenantId, monthKey, publicKey, and signature are required' });
    }
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
        return res.status(400).json({ error: 'monthKey must be YYYY-MM' });
    }
    try {
        const result = await closePeriod(req.pool, Number(tenantId), monthKey, publicKey, signature);
        res.json(result);
    } catch (err) {
        const status = err.message.startsWith('GOVERNANCE_REJECTED') ? 403 : 500;
        res.status(status).json({ error: err.message });
    }
});

// ---- GET /api/governance/audit-log ----------------------------------------
// Return the signed audit trail for a tenant.
router.get('/audit-log', async (req, res) => {
    const { tenantId, limit = '50', offset = '0' } = req.query;
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    try {
        const { rows } = await req.pool.query(
            `SELECT a.id, a.ledger_row_id, a.admin_address, a.previous_category,
                    a.new_category, a.created_at,
                    l.payment_number, l.vendor_name
               FROM admin_override_audit_logs a
               LEFT JOIN repay_payment_ledger l ON l.id = a.ledger_row_id
              WHERE a.tenant_id = $1
              ORDER BY a.created_at DESC
              LIMIT $2 OFFSET $3`,
            [Number(tenantId), Number(limit), Number(offset)]
        );
        res.json({ rows, total: rows.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
