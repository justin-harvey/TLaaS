# Blocker Fix Plan — TLaaS Engineering
**Status:** Pre-work required before any code changes  
**Blockers:** C-1 (2 segments), C-2 (2 segments), C-3 (5 segments)  
**Total segments:** 9 — each independently testable and committable

---

## Version control setup (do this first, touch nothing else)

```bash
# 1. Confirm you're on main and the tree is clean
git checkout main
git status   # must show "nothing to commit"

# 2. Tag the as-delivered state — this is your rollback point
git tag v0.1.0-prefix
git push origin v0.1.0-prefix

# 3. Create branches for each blocker IN ORDER
#    Do not open C-2 branch until C-1 is merged.
#    Do not open C-3 branch until C-2 is merged.
git checkout -b fix/c1-standalone-and-api-url
```

The sequential branch rule prevents merge conflicts. Each branch is
small enough to review in a single session and revert cleanly if needed.

---

## C-1 — Next.js standalone + API URL

**Root cause (two separate issues in the same branch):**
- `next.config.ts` is missing `output: 'standalone'` → Docker runner crashes
- `NEXT_PUBLIC_API_URL` is set to `http://validator:4000` in `docker-compose.yml`
  but baked into the browser bundle at build time → every client-side API call
  fails with a DNS error because the browser cannot resolve the Docker network hostname

**Files in scope (this branch touches NOTHING else):**
```
frontend/next.config.ts          ← C-1a
frontend/Dockerfile              ← C-1a (verify COPY paths match standalone output)
docker-compose.yml               ← C-1b
.env.example                     ← C-1b
```

---

### Segment C-1a — Enable standalone output

**Change:**
```typescript
// frontend/next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',   // ← ADD THIS LINE
  reactStrictMode: true,
  transpilePackages: ['@ag-grid-community'],
};
```

**Downstream effects to verify after this change:**
Next.js standalone output restructures the build artefact:
- `.next/standalone/server.js` — the production server (the Dockerfile already copies this ✓)
- `.next/standalone/.next/static/` — static chunks
- `.next/standalone/public/` — does NOT auto-copy `public/`; must be explicit

The current Dockerfile runner stage is:
```dockerfile
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
```
All three COPY statements are correct for standalone output. No Dockerfile change needed.

**Test gate for C-1a (run before committing):**
```bash
cd frontend
npm run build
# Must complete without errors and produce:
ls .next/standalone/server.js     # must exist
ls .next/standalone/.next/static  # must exist
```

---

### Segment C-1b — Fix API URL for browser-side calls

**The problem in detail:**
`NEXT_PUBLIC_*` variables are inlined by the compiler into the JavaScript
bundle at `npm run build` time. The value `http://validator:4000` gets
embedded in the browser bundle. The browser has no knowledge of Docker
network hostnames. Every fetch to `NEXT_PUBLIC_API_URL` returns a
network error in production.

**Changes:**

`docker-compose.yml` — remove the build-time baked URL, use a runtime
placeholder that the Next.js server can read server-side:
```yaml
frontend:
  environment:
    NODE_ENV: production
    # API_URL is read server-side only (no NEXT_PUBLIC_ prefix).
    # Client-side calls route through /api/proxy/* handled by Next.js.
    INTERNAL_API_URL: http://validator:${API_PORT:-4000}
```

The cleanest architectural fix is a **Next.js Route Handler proxy**:
the browser calls `/api/governance/*` on the same origin, and Next.js
forwards the request to the internal validator URL server-side. This
eliminates CORS entirely and keeps the validator off the public internet.

**New file: `frontend/src/app/api/governance/[...path]/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';

const VALIDATOR = process.env.INTERNAL_API_URL ?? 'http://localhost:4000';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path  = params.path.join('/');
  const url   = `${VALIDATOR}/api/governance/${path}${req.nextUrl.search}`;
  const upstream = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  const data  = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const body = await req.json();
  const url  = `${VALIDATOR}/api/governance/${path}`;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
```

**Update `frontend/src/lib/governance.ts`** — change API base:
```typescript
// Before:
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// After: empty string means "same origin" — routes through Next.js proxy
const API = '';
```

**Update `frontend/src/lib/api.ts`** — same change:
```typescript
// Before:
const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

// After (no change needed — BASE is already '' which means same-origin)
// Verify all fetch calls use relative paths via BASE.
```

**Update `.env.example`:**
```bash
# Remove:
# NEXT_PUBLIC_API_URL=...

# Add:
INTERNAL_API_URL=http://localhost:4000   # Docker: http://validator:4000
```

**Downstream effects to verify:**
- `CORS_ORIGIN` in validator can now be removed or set to `*` safely —
  the browser never calls the validator directly
- The `validator/server.js` CORS middleware becomes optional for the
  governance routes (keep it for direct local development access)
- `docker-compose.yml` frontend environment block no longer needs
  `NEXT_PUBLIC_API_URL` — remove it to prevent future confusion

**Test gate for C-1b:**
```bash
# Local dev (no Docker):
INTERNAL_API_URL=http://localhost:4000 npm run dev
# Open http://localhost:3000 → Verify page → should reach the API
# Check network tab: calls should go to localhost:3000/api/governance/*, not localhost:4000

# Docker:
docker compose up --build -d
docker compose logs frontend | grep -i error
curl http://localhost:3000/api/governance/admin-status?tenantId=1&publicKey=GTEST
# Should return JSON (even if {authorised: false}) — not a network error
```

**Commit C-1 when both gates pass. Open a PR. Merge before starting C-2.**

---

## C-2 — Fingerprint parity enforcement

**Root cause (less severe than flagged):**
The actual diff between the two `fingerprint.js` copies is exactly
one comment line. The hash functions are currently identical.
The risk is future drift, not a current hash mismatch.

**Fix strategy:** make them byte-identical again + add an automated
guard so drift is caught immediately if it happens again.

**Files in scope:**
```
indexer/fingerprint.js          ← remove the extra comment line
.github/workflows/ci.yml        ← NEW: automated diff check + unit tests
```

---

### Segment C-2a — Restore byte identity

```bash
git checkout -b fix/c2-fingerprint-parity
```

**Change to `indexer/fingerprint.js`:**
Remove only this line (line 2 as inserted by the earlier `sed -i`):
```
// ⚠️ COPY of validator/fingerprint.js — MUST stay byte-identical (shared hash contract).
```

Move that warning to the TOP of `validator/fingerprint.js` instead —
it belongs on the canonical source:
```javascript
// validator/fingerprint.js
// ---------------------------------------------------------------------------
// CANONICAL SOURCE. indexer/fingerprint.js must be a byte-identical copy.
// If you change this file, update indexer/fingerprint.js identically.
// The CI diff check will fail the build if they diverge.
// ---------------------------------------------------------------------------
import crypto from 'crypto';
// ... rest unchanged
```

**Verify:**
```bash
diff validator/fingerprint.js indexer/fingerprint.js
# Must produce NO output (files are identical)
md5sum validator/fingerprint.js indexer/fingerprint.js
# Both lines must show the same hash
```

---

### Segment C-2b — Automated parity guard

**New file: `.github/workflows/ci.yml`**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  fingerprint-parity:
    name: fingerprint.js parity check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Fail if fingerprint.js files have drifted
        run: |
          diff validator/fingerprint.js indexer/fingerprint.js \
            || (echo "❌ fingerprint.js drift detected — update both files identically" && exit 1)

  unit-tests:
    name: DB-free unit tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [validator, indexer]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: ${{ matrix.service }}/package-lock.json
      - run: cd ${{ matrix.service }} && npm ci
      - name: Run unit tests
        run: |
          if [ "${{ matrix.service }}" = "validator" ]; then
            cd validator
            node test-unit.js
            node test-repay-unit.js
            node test-governance-unit.js
            node test-adversarial.js
          else
            cd indexer
            node test-indexer-unit.js
          fi

  lockfile-check:
    name: Lockfiles committed
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Fail if any lockfile is missing
        run: |
          for dir in validator indexer frontend; do
            [ -f "$dir/package-lock.json" ] \
              || (echo "❌ Missing $dir/package-lock.json — run npm install and commit" && exit 1)
          done
```

**Note:** The `npm ci` step will fail until lockfiles are committed.
That is intentional — the CI check enforces the fix for R-1 (missing
lockfiles) and will start passing once they are generated and committed.

**Test gate for C-2:**
```bash
# Both lines must match:
diff validator/fingerprint.js indexer/fingerprint.js   # no output
cd validator && node test-unit.js     # 9 checks green
cd indexer  && node test-indexer-unit.js  # 4 checks green
```

**Commit C-2 when both segments pass. Merge before starting C-3.**

---

## C-3 — Close-of-Period signs actual fingerprint

**Root cause:**
The admin signs `'pending'` as the fingerprint value rather than the
real SHA-256 of the settled data. This breaks the chain-of-custody
guarantee — the governance model's core value proposition.

**Branch:**
```bash
git checkout -b fix/c3-close-period-signing
```

This fix requires coordinated changes across the full stack.
The segments are ordered so that at each step the tests pass and
the system is in a consistent (if not yet complete) state.
Do not skip segments or combine them.

**Files in scope:**
```
validator/governance-routes.js      ← S1: new endpoint
validator/governance-service.js     ← S2: verify submitted fingerprint
validator/governance-pure.js        ← S3: serialisation contract (unchanged)
frontend/src/lib/governance.ts      ← S4: fetch then sign
frontend/src/components/cc/GovernancePanel.tsx  ← S4: UI state
validator/test-governance-unit.js   ← S5: update mock + add new tests
```

---

### Segment C-3a — New backend endpoint: month summary

Add to `validator/governance-routes.js` (no changes to existing routes):

```javascript
// GET /api/governance/month-summary
// Returns the current fingerprint and row count for a tenant+month.
// The frontend fetches this BEFORE building the signed Close-of-Period intent.
router.get('/month-summary', async (req, res) => {
    const { tenantId, monthKey } = req.query;
    if (!tenantId || !monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
        return res.status(400).json({ error: 'tenantId and monthKey (YYYY-MM) required' });
    }
    try {
        const { rows } = await req.pool.query(
            `SELECT creation_date, vendor_name, mcc_code, assigned_category, total_amount
               FROM repay_payment_ledger
              WHERE tenant_id = $1 AND to_char(creation_date,'YYYY-MM') = $2`,
            [Number(tenantId), monthKey]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'No rows found for this period.' });
        const { computeFingerprint, buildSanitizedRow } = await import('./fingerprint.js');
        const fingerprintHex = computeFingerprint(rows.map(r => buildSanitizedRow({
            date:     new Date(r.creation_date).toISOString().split('T')[0],
            merchant: r.vendor_name,
            mcc:      r.mcc_code,
            category: r.assigned_category,
            amount:   Number(r.total_amount),
        })));
        res.json({ fingerprintHex, rowCount: rows.length, monthKey, tenantId: Number(tenantId) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

**Downstream effects:** None. New route only. Existing routes unchanged.

**Test gate for C-3a:** Syntax check only at this stage:
```bash
node --check validator/governance-routes.js
```

---

### Segment C-3b — Backend: verify submitted fingerprint

Update `closePeriod` in `validator/governance-service.js`.
The function currently computes the fingerprint internally and ignores
whatever the client submitted. Add a verification step:

```javascript
export async function closePeriod(pool, tenantId, monthKey, publicKey, signatureB64, submittedFingerprintHex) {
    // 1. Compute the fingerprint server-side (source of truth)
    const { rows } = await pool.query(...); // unchanged
    const computedFingerprintHex = computeFingerprint(...); // unchanged

    // 2. NEW: verify the submitted fingerprint matches what we computed
    if (submittedFingerprintHex !== computedFingerprintHex) {
        throw new Error('GOVERNANCE_REJECTED: Submitted fingerprint does not match current ledger state. Re-fetch and re-sign.');
    }

    // 3. Verify signature against the intent that INCLUDES the real fingerprint
    const intentString = serialiseClosePeriodIntent(tenantId, monthKey, computedFingerprintHex, /* timestamp from client */ );
    if (!verifySignature(intentString, signatureB64, publicKey)) {
        throw new Error('GOVERNANCE_REJECTED: Ed25519 signature is invalid.');
    }
    // ... rest unchanged
}
```

Update `governance-routes.js` `/close-period` handler to pass the new param:
```javascript
const { tenantId, monthKey, publicKey, signature, fingerprintHex } = req.body;
// add 'fingerprintHex' to required field check
const result = await closePeriod(req.pool, Number(tenantId), monthKey, publicKey, signature, fingerprintHex);
```

**Downstream effects:** The function signature of `closePeriod` changes.
Nothing else calls `closePeriod` except the route handler. Safe.

**Test gate for C-3b:**
```bash
node --check validator/governance-service.js
node --check validator/governance-routes.js
```

---

### Segment C-3c — Frontend: fetch fingerprint before signing

The `serialiseClosePeriodIntent` function signature does not change —
`'pending'` simply gets replaced with the real value.

Update `frontend/src/lib/governance.ts`:

```typescript
// New: fetch current fingerprint from the server before signing
export async function fetchMonthSummary(tenantId: number, monthKey: string): Promise<{
  fingerprintHex: string; rowCount: number;
}> {
  const r = await fetch(`${API}/api/governance/month-summary?tenantId=${tenantId}&monthKey=${monthKey}`);
  if (!r.ok) throw new Error('Could not fetch period summary. Ensure data has been ingested for this month.');
  return r.json();
}

// Updated: fetches fingerprint first, then signs intent that includes it
export async function submitClosePeriod(tenantId: number, monthKey: string): Promise<{
  success: boolean; stellarTxHash: string; fingerprintHex: string; ledger: number;
}> {
  // Step 1: get the real fingerprint
  const { fingerprintHex } = await fetchMonthSummary(tenantId, monthKey);

  // Step 2: sign an intent that commits to this specific fingerprint
  const timestamp = Date.now();
  const intentStr = serialiseClosePeriodIntent(tenantId, monthKey, fingerprintHex, timestamp);
  const { signature, publicKey } = await signMessage(intentStr);

  // Step 3: submit with the fingerprint so the server can verify both
  const r = await fetch(`${API}/api/governance/close-period`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, monthKey, publicKey, signature, fingerprintHex }),
  });
  if (!r.ok) { const err = await r.json(); throw new Error(err.error || 'Close-of-Period failed'); }
  return r.json();
}
```

**Downstream effects on GovernancePanel.tsx:** The close period flow now
has an async fetch step before the Freighter signing prompt. The UI needs
a loading state during the fetch. Add one state:

```typescript
// In GovernancePanel.tsx, add to existing state:
const [summaryLoading, setSL] = useState(false);
const [summaryError, setSErr]  = useState('');

// Replace the Close Period button's onClick:
const closePeriod = async () => {
    setSL(true); setSErr('');
    try {
        // submitClosePeriod now fetches + signs internally
        setCS('anchoring');
        const r = await submitClosePeriod(tenantId, monthKey);
        setCTx(r.stellarTxHash);
        setCS('done');
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Anchor failed.';
        setSErr(msg);
        setCS('error');
    } finally { setSL(false); }
};
```

**Test gate for C-3c:**
```bash
npx tsc --noEmit   # TypeScript must pass with no errors
```

---

### Segment C-3d — Update unit tests

The governance unit tests need one update: the `closePeriod` mock
should pass a fingerprint argument to match the new signature.
The governance-pure.js `serialiseClosePeriodIntent` already accepts a
real fingerprint — no change needed there.

Update `validator/test-governance-unit.js`:

```javascript
// The existing close-period serialisation test uses 'deadbeef' — already correct.
// Verify the test still asserts that:
//   1. The fingerprint in the serialised intent matches what was passed in
//   2. 'pending' no longer appears in any signed payload

check('close-period intent contains real hash not placeholder', () => {
    const hash = 'a'.repeat(64);
    const s = JSON.parse(serialiseClosePeriodIntent(1, '2026-06', hash, 9999));
    assert.strictEqual(s.hash, hash);
    assert.ok(!s.hash.includes('pending'), '"pending" must not appear in signed intent');
});
```

**Final test gate for C-3 (run all):**
```bash
cd validator && node test-governance-unit.js   # all checks green
npx tsc --noEmit                               # frontend TypeScript clean
node --check validator/governance-service.js
node --check validator/governance-routes.js
```

---

## Final merge order and verification

```
main
  └─ fix/c1-standalone-and-api-url   → merge first
       └─ fix/c2-fingerprint-parity  → merge second
            └─ fix/c3-close-period-signing  → merge last
                  └─ tag v0.1.1-blockers-resolved
```

After all three are merged, run the complete suite from the repo root:
```bash
(cd validator && node test-unit.js && node test-repay-unit.js && node test-governance-unit.js && node test-adversarial.js)
(cd indexer  && node test-indexer-unit.js)
diff validator/fingerprint.js indexer/fingerprint.js   # no output
(cd frontend && npx tsc --noEmit)
docker compose up --build -d
curl http://localhost:3000/api/governance/month-summary?tenantId=1&monthKey=2026-06
```

If all pass, tag `v0.1.1-blockers-resolved` and open the P1 security
findings (S-1 API authentication, E-1 start.sh error handling, E-2
graceful shutdown) as the next branch set.

---

## What not to touch in each branch

| Branch | Do not touch |
|---|---|
| fix/c1-* | validator/, indexer/, contracts/, tests |
| fix/c2-* | frontend/, validator code (not tests), governance-service |
| fix/c3-* | fingerprint.js files, Docker configs, next.config.ts |

Any change outside the defined scope for a branch is a scope creep
signal. Stop, commit what you have, open a new branch for the
unrelated change.
