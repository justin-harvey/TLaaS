# TLaaS Production Launch Checklist

Use this sequentially. Check each item off before moving to the next.
All gates from the build phases must pass before any mainnet step.

---

## Pre-flight: phase gates

- [ ] Phase 1 gate passes: `bash db/verify.sh` — 9 tables, 64 MCC rules, SPIKE demo
- [ ] Phase 2 unit gate: `cd validator && node test-unit.js` — 9 checks green
- [ ] Phase 2.5 unit gate: `node test-repay-unit.js` — 7 checks green
- [ ] Phase 4 unit gate: `cd indexer && node test-indexer-unit.js` — 4 checks green
- [ ] Phase 6 unit gate: `cd validator && node test-governance-unit.js` — 11 checks green
- [ ] Phase 8 adversarial gate: `node test-adversarial.js` — 13 checks green

---

## Step 1 — Secrets & environment

- [ ] Copy `.env.example` to `.env.production` — never commit the populated file.
- [ ] Generate a strong `DB_PASSWORD` (≥32 random chars).
- [ ] Confirm `STELLAR_RPC_URL` and `STELLAR_NETWORK_PASSPHRASE` are set to **Testnet** for final integration testing.
- [ ] Confirm `SERVER_SECRET_KEY` is the deployer keypair secret from `stellar keys show tlaas_admin` (Phase 3).

---

## Step 2 — Contract deployment (Testnet → integration)

- [ ] Run `bash contracts/tlaas_anchor/deploy.sh` — confirms a live Contract ID on Testnet.
- [ ] Run `bash contracts/tlaas_anchor/verify.sh <CONTRACT_ID>` — immutability proven.
- [ ] Copy the printed `SOROBAN_LEDGER_CONTRACT_ID` into `.env.production`.
- [ ] Run Phase 4 integration gate: `cd indexer && DATABASE_URL=... ... node test-indexer.js`
- [ ] Run Phase 6 integration gate (override + Close-of-Period with real Freighter wallet).

---

## Step 3 — Container stack (Testnet)

- [ ] `docker compose --env-file .env.production up --build -d`
- [ ] All four containers reach healthy status: `docker compose ps`
- [ ] `curl http://localhost:4000/health` returns `{"ok":true}`.
- [ ] `curl http://localhost:3000` loads the dashboard.
- [ ] Drop a real RePay file into the dropzone volume and confirm ingestion within 15s:
      ```bash
      docker cp validator/samples/clean_repay.json tlaas_validator:/mnt/drops/1__automotive__repay__june.json
      docker compose logs -f validator   # watch for ✅ log line
      ```
- [ ] Open the dashboard → Ledger Explorer → row visible → Verify page shows ✅ match.
- [ ] Connect Freighter → GovernancePanel → reclassify a row → audit log entry appears.
- [ ] Close-of-Period → Stellar anchor fires → indexer writes `is_verified = true`.
- [ ] Run `bash db/verify-billing.sh 2026-06` and confirm totals reconcile.

---

## Step 4 — Security hardening

- [ ] SFTP dropzone: mount `repay_dropzones` volume to an SFTP chroot with key-only auth. No password auth, no shell access.
- [ ] CORS: set `CORS_ORIGIN` to the exact production frontend domain (not `*`).
- [ ] API rate limiting: add nginx or Caddy in front of `:4000` with a rate limit of 60 req/min per IP.
- [ ] DB: revoke public schema CREATE permission; create a read-only `tlaas_reader` role for the frontend API queries.
- [ ] Secrets rotation plan: `SERVER_SECRET_KEY` should be rotated after the first pilot month; the contract admin address does not need to change if the new key is registered via `set_tenant_admin`.
- [ ] Backups: confirm `postgres_data` volume is snapshotted nightly; test restore.
- [ ] TLS: confirm all external endpoints (`:3000`, `:4000`) are behind a reverse proxy with valid certificates.

---

## Step 5 — Mainnet cutover

**Do not perform these steps until Testnet integration is fully verified.**

- [ ] Update `.env.production`:
      ```
      STELLAR_RPC_URL=https://soroban-mainnet.stellar.org
      STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
      ```
- [ ] Fund the mainnet server key with at least 5 XLM (for contract fees).
      ```bash
      stellar keys fund tlaas_admin --network mainnet   # via your own funding method
      ```
- [ ] Re-run `bash contracts/tlaas_anchor/deploy.sh` against mainnet.
- [ ] Copy the new mainnet `SOROBAN_LEDGER_CONTRACT_ID` into `.env.production`.
- [ ] Run `docker compose --env-file .env.production down && docker compose --env-file .env.production up -d`
- [ ] Verify the indexer is polling mainnet: `docker compose logs indexer | grep "Indexer listening"`
- [ ] Register the first pilot tenant admin address on-chain:
      ```bash
      stellar contract invoke --id $SOROBAN_LEDGER_CONTRACT_ID --source tlaas_admin --network mainnet \
        -- set_tenant_admin --tenant_id 1 --tenant_admin <PILOT_ADMIN_G_ADDRESS>
      ```

---

## Step 6 — Pilot tenant onboarding

- [ ] Insert the pilot tenant into the DB:
      ```sql
      INSERT INTO tenants (company_name, slug, industry_id, stellar_admin_address)
      SELECT 'Pilot Municipality', 'pilot-muni', i.id, '<PILOT_ADMIN_G_ADDRESS>'
      FROM industries i WHERE i.name = 'Municipal';
      ```
- [ ] Provide the pilot tenant with the SFTP dropzone credentials.
- [ ] Send the pilot the dashboard URL and Freighter wallet setup guide.
- [ ] After the first real payment file is dropped and ingested, run:
      ```bash
      bash db/verify-billing.sh $(date +%Y-%m)
      ```
- [ ] Confirm pilot admin can connect Freighter, sees GovernancePanel, and can reclassify.
- [ ] Schedule the first Close-of-Period anchor for end of the calendar month.

---

## Ongoing

- Monitor: `docker compose logs -f` daily for quarantine events and anchor failures.
- Billing: run `bash db/verify-billing.sh` at the start of each month.
- Fingerprint drift: any `is_verified = false` in `stellar_anchors` is a critical alert.
- Schema updates: always add as additive migrations; never `DROP COLUMN` without a retention plan.
