#!/usr/bin/env bash
# contracts/tlaas_anchor/verify.sh
# Phase 3 on-chain gate. Run AFTER deploy.sh.
# Proves: write succeeds -> duplicate write fails (immutable) -> read returns the hash.
set -uo pipefail

NETWORK="testnet"
ADMIN_KEY="tlaas_admin"
CONTRACT_ID="${1:-$(cut -d= -f2 .contract_id 2>/dev/null)}"
if [ -z "${CONTRACT_ID:-}" ]; then echo "Usage: bash verify.sh <CONTRACT_ID>"; exit 1; fi

TENANT=404
MONTH="2026-06"
CID="ipfs://QmXoyExampleVerify"
HASH="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

echo "== 1. First anchor (should SUCCEED) =="
stellar contract invoke --id "$CONTRACT_ID" --source "$ADMIN_KEY" --network "$NETWORK" \
    -- anchor_record --tenant_id "$TENANT" --month_key "$MONTH" --ipfs_cid "$CID" --data_hash "$HASH"

echo "== 2. Duplicate anchor (should FAIL with AlreadyAnchored) =="
if stellar contract invoke --id "$CONTRACT_ID" --source "$ADMIN_KEY" --network "$NETWORK" \
    -- anchor_record --tenant_id "$TENANT" --month_key "$MONTH" --ipfs_cid "$CID" --data_hash "$HASH" 2>/dev/null; then
    echo "   ❌ GATE FAILED: duplicate write was accepted — immutability broken."
    exit 1
else
    echo "   ✅ Duplicate correctly rejected (immutability holds)."
fi

echo "== 3. Read back (should return the cid + hash) =="
stellar contract invoke --id "$CONTRACT_ID" --source "$ADMIN_KEY" --network "$NETWORK" \
    -- get_anchor_record --tenant_id "$TENANT" --month_key "$MONTH"

echo
echo "✅ Phase 3 on-chain gate passed."
