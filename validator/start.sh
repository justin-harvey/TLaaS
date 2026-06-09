#!/bin/sh
# validator/start.sh
# Runs two processes in the validator container:
#   1. server.js  — Express governance API on $API_PORT (default 4000)
#   2. index.js   — Dropzone poller, re-runs every $POLL_INTERVAL seconds (default 15)
#
# If server.js exits for any reason, the container exits (so orchestration restarts it).
# The poller loop is intentionally fire-and-forget per cycle.
set -e

POLL_INTERVAL="${POLL_INTERVAL:-15}"

echo "[start.sh] Starting governance API server..."
node server.js &
SERVER_PID=$!

echo "[start.sh] Starting dropzone poller (interval: ${POLL_INTERVAL}s)..."
while true; do
    node index.js 2>&1 || true   # 'true' so a parse error doesn't kill the watcher
    sleep "$POLL_INTERVAL"
done &
WATCHER_PID=$!

# Exit the container if the API server dies (the watcher loop will be reaped by the OS)
wait $SERVER_PID
echo "[start.sh] API server exited — shutting down container."
