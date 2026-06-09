# TLaaS — Trustless Ledger as a Service

Hybrid off-chain Postgres cache + Stellar/Soroban anchoring layer. Provable,
tamper-evident financial analytics with $0-per-seat pricing.

## Repo layout

```
tlaas-root/
├── docker-compose.db.yml   # Phase-1 DB-only harness (full compose lands in Phase 7)
├── .env.example            # every required key, placeholdered
├── .gitignore
├── db/
│   ├── init.sql            # ✅ Phase 1 — schema, ruleset, views, seed
│   └── verify.sh           # ✅ Phase 1 Definition-of-Done gate
├── validator/              # ✅ Phase 2 — ingestion + 3-tier circuit breaker (Plaid/MCC)
│   ├── fingerprint.js      #    deterministic hash contract (frontend must match)
│   ├── circuit-breaker.js  #    3-tier validation (pure)
│   ├── pipeline.js         #    MCC tagging via ruleset join + atomic ingest + metering
│   ├── index.js            #    orchestrator (CLI + dropzone scan)
│   ├── test-unit.js        #    DB-free tests (run anywhere)
│   ├── test-pipeline.js    #    integration gate (needs DB)
│   ├── stellar-broadcast.js #   ✅ Phase 3 — anchor + read worker
│   ├── industry-limits.js  #   ✅ Phase 2.5 — shared anomaly ceilings
│   ├── parse.js            #   ✅ Phase 2.5 — RePay normalizers (money/type/date)
│   ├── repay-circuit-breaker.js # Phase 2.5 — 3-tier validator (vendor-name path)
│   ├── repay-pipeline.js   #   ✅ Phase 2.5 — vendor-name tagging + atomic ingest
│   ├── test-repay-unit.js  #   ✅ Phase 2.5 — DB-free RePay tests (real screenshot fixture)
│   ├── test-repay-pipeline.js # Phase 2.5 — integration gate
│   └── samples/            #    clean_plaid, corrupted_plaid, clean_repay, corrupted_repay
├── contracts/
│   └── tlaas_anchor/       # ✅ Phase 3 — Soroban anchor contract (Rust)
│       ├── Cargo.toml
│       ├── src/lib.rs      #    anchor_record / get_anchor_record / tenant-admin registry
│       ├── src/test.rs     #    cargo test gate
│       ├── deploy.sh       #    build -> optimize -> deploy -> initialize
│       └── verify.sh       #    on-chain immutability gate
├── indexer/                # ✅ Phase 4 — Soroban event sync + cache verification
│   ├── fingerprint.js      #    copy of validator/fingerprint.js (keep in sync)
│   ├── indexer-db.js       #    pure DB logic (recomputeAndVerify, recordAnchor)
│   ├── indexer.js          #    Stellar decode + polling loop
│   ├── test-indexer-unit.js #   DB-free idempotency + meter-once tests
│   ├── test-indexer.js     #    integration gate (requires deployed contract)
│   ├── package.json
│   └── Dockerfile
├── frontend/               # ✅ Phase 5 — Next.js 15 analytics dashboard
│   ├── src/app/            #    5 pages: overview, ledger, query, verify, anomalies
│   ├── src/components/cc/  #    CC design system (Button, Badge, Card, StatTile, HashChip, BudgetBar, Input)
│   ├── src/lib/            #    api client, fixtures, utils + client-side fingerprint port
│   ├── src/types/          #    all TypeScript types from the handoff
│   ├── src/styles/         #    globals.css with full CC token set
│   ├── tailwind.config.ts  #    CC tokens mapped to Tailwind classes
│   └── Dockerfile
```

## Build status

| Phase | Component | Status |
|---|---|---|
| 0 | Scaffolding | ✅ done |
| 1 | DB cache, schema, views, seed | ✅ done |
| 2 | Ingestion + circuit breaker (Plaid/MCC) | ✅ done |
| 2.5 | RePay adapter (vendor-name mapping) | ✅ done |
| 3 | Soroban contract + deploy | ✅ done |
| 4 | Indexer / state sync | ✅ done |
| 5 | Public dashboard | ✅ done |
| 6 | Governance + Close-of-Period | ✅ done |

| 7 | Containerization | ✅ done |
| 8 | Harden, meter, launch | ✅ done |

## Run the Phase 1 gate

```bash
cp .env.example .env          # edit DB_PASSWORD if you like
docker compose -f docker-compose.db.yml up --build -d
bash db/verify.sh             # prints object inventory, seed counts, SPIKE demo
docker compose -f docker-compose.db.yml down -v   # tear down + wipe
```

Gate passes when the inventory shows **8 tables, 1 view, 1 materialized view**,
seed counts match (4 industries / 64 ruleset rows / 16 MCC refs / 1 tenant), and
the June "Inventory Sourcing" sample row flags `anomaly_status = SPIKE`.

## Run the Phase 2 gate

```bash
# DB-free unit tests (circuit breaker + hash determinism) — run anywhere:
cd validator && npm run test:unit

# Full integration gate — needs the Phase 1 DB running:
docker compose -f ../docker-compose.db.yml up -d
npm install
DATABASE_URL=postgres://postgres:secret_password@localhost:5432/tlaas_ledger npm run test:integration
```

Unit gate passes when all 9 checks are green. Integration gate passes when the
clean payload ingests 3 rows with correct MCC→category tags, metering increments
to 3, the returned fingerprint matches a recomputation from the cache, and the
corrupted payload is rejected with **zero** rows reaching the cache (atomicity).

## Run the Phase 3 gate

```bash
cd contracts/tlaas_anchor

# Local gate — no network needed:
cargo test                       # roundtrip, none-read, double-anchor-fails, registry

# On-chain gate — Testnet (Friendbot funds the key automatically):
bash deploy.sh                   # prints SOROBAN_LEDGER_CONTRACT_ID
bash verify.sh                   # write -> duplicate fails -> read back
```

`cargo test` passes when all four tests are green (the double-anchor test must
panic with `AlreadyAnchored`). The on-chain gate passes when the first anchor
succeeds, the duplicate is rejected, and the read returns the cid + hash.

After deploy, put the printed `SOROBAN_LEDGER_CONTRACT_ID` and the deployer
secret (`stellar keys show tlaas_admin`) as `SERVER_SECRET_KEY` into `.env.production`
— the broadcaster signs as the instance admin.

## Run the Phase 2.5 gate

```bash
# DB-free (run anywhere):
cd validator && node test-repay-unit.js        # 7 checks, real screenshot fixture

# Integration (needs DB):
DATABASE_URL=... node test-repay-pipeline.js   # maps DECKER→Inventory, type normalizes, atomicity
```

## Run the Phase 4 gate

```bash
# DB-free (run anywhere):
cd indexer && node test-indexer-unit.js        # 4 checks, idempotency + meter-once

# Integration (needs DB + deployed contract):
cd indexer && npm install
DATABASE_URL=... SOROBAN_LEDGER_CONTRACT_ID=... SERVER_SECRET_KEY=... \
STELLAR_RPC_URL=... STELLAR_NETWORK_PASSPHRASE=... node test-indexer.js
```

Gate passes when the indexer detects the on-chain event within one poll cycle
and writes a `stellar_anchors` row with `is_verified = true`.

## Run Phase 5 (dashboard)

```bash
cd frontend
npm install
npm run dev        # → http://localhost:3000 (auto-redirects to /overview)
```

Mock data (Town of Millbrook, NH) is wired by default — no backend needed
for the UI. Set `NEXT_PUBLIC_API_URL=http://localhost:4000` in `.env.local`
to point at the real TLaaS backend once Phase 6 is complete.





## Notes carried from the blueprints

- **Anchor on settlement, not every write** — on-chain writes fire only on an
  explicit Close-of-Period action (Phase 6). All analytics serve from this cache.
- **Stellar config** uses the real Soroban Testnet RPC
  (`https://soroban-testnet.stellar.org`) and passphrase
  (`Test SDF Network ; September 2015`) — corrected from the blueprint placeholders.
- **Scope stays narrow** — Plaid + RePay feeds only; the `industry_mcc_ruleset`
  table is the semantic layer, not a general DB-connector tool.
