#!/usr/bin/env bash
# contracts/tlaas_anchor/deploy.sh
# Compile -> optimize -> deploy -> initialize the TLaaS anchor contract on Testnet.
#
# Prereqs (one time):
#   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
#   rustup target add wasm32-unknown-unknown
#   cargo install --locked stellar-cli
set -euo pipefail

NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
PASSPHRASE="Test SDF Network ; September 2015"
ADMIN_KEY="tlaas_admin"
WASM="target/wasm32-unknown-unknown/release/tlaas_anchor.wasm"
OPT_WASM="target/wasm32-unknown-unknown/release/tlaas_anchor.optimized.wasm"

echo "== 1. Register Testnet with the CLI =="
stellar network add "$NETWORK" --rpc-url "$RPC_URL" --network-passphrase "$PASSPHRASE" 2>/dev/null || true

echo "== 2. Deployer key (Friendbot-funded on first run) =="
if ! stellar keys address "$ADMIN_KEY" &>/dev/null; then
    stellar keys generate "$ADMIN_KEY" --network "$NETWORK" --fund
fi
ADMIN_ADDR=$(stellar keys address "$ADMIN_KEY")
echo "   Deployer / instance admin: $ADMIN_ADDR"

echo "== 3. Build WASM =="
cargo build --target wasm32-unknown-unknown --release

echo "== 4. Optimize WASM (shrinks on-chain storage cost) =="
stellar contract optimize --wasm "$WASM"

echo "== 5. Deploy (install + instantiate) =="
CONTRACT_ID=$(stellar contract deploy --wasm "$OPT_WASM" --source "$ADMIN_KEY" --network "$NETWORK")
echo "   Contract ID: $CONTRACT_ID"

echo "== 6. Initialize (instance admin = deployer) =="
stellar contract invoke --id "$CONTRACT_ID" --source "$ADMIN_KEY" --network "$NETWORK" \
    -- initialize --admin "$ADMIN_ADDR"

echo
echo "=========================================================="
echo "🎉 TLaaS Anchor live on Testnet"
echo "   SOROBAN_LEDGER_CONTRACT_ID=$CONTRACT_ID"
echo "=========================================================="
echo "Add to your .env.production:"
echo "   SOROBAN_LEDGER_CONTRACT_ID=$CONTRACT_ID"
echo "   SERVER_SECRET_KEY=\$(stellar keys show $ADMIN_KEY)   # the broadcaster signs as instance admin"
echo

# Persist for convenience.
echo "SOROBAN_LEDGER_CONTRACT_ID=$CONTRACT_ID" > .contract_id
