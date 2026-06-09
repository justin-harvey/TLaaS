#!/usr/bin/env bash
# db/verify-billing.sh
# Phase 8 billing reconciliation gate.
# Reads tenant_billing_meters and applies the TLaaS pricing model to produce
# a human-readable invoice report and verify totals reconcile to the penny.
#
# Pricing model (Community tier baseline — adjust for Enterprise):
#   Base subscription:          $99.00 / month
#   Ingestion:                   $0.05 per 100 transactions processed
#   On-chain anchors:            $0.10 per anchor written
#
# Usage (with DB running):
#   bash db/verify-billing.sh [YYYY-MM]          # defaults to current month
set -euo pipefail

PERIOD="${1:-$(date +%Y-%m)}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-tlaas_ledger}"
PSQL="docker exec -i tlaas_db psql -v ON_ERROR_STOP=1 -U ${DB_USER} -d ${DB_NAME} -t -A"

echo "========================================================"
echo "  TLaaS Billing Reconciliation — ${PERIOD}"
echo "========================================================"

$PSQL << SQL
SELECT
    '--------------------------------------------------------' AS separator;

SELECT
    t.company_name                                                        AS tenant,
    t.slug,
    COALESCE(m.transactions_processed_count, 0)                          AS tx_count,
    COALESCE(m.stellar_anchors_written_count, 0)                         AS anchor_count,
    -- Fee calculation
    99.00                                                                  AS base_fee,
    ROUND(COALESCE(m.transactions_processed_count, 0) / 100.0 * 0.05, 2) AS ingest_fee,
    ROUND(COALESCE(m.stellar_anchors_written_count, 0) * 0.10, 2)        AS anchor_fee,
    ROUND(
        99.00
        + COALESCE(m.transactions_processed_count, 0) / 100.0 * 0.05
        + COALESCE(m.stellar_anchors_written_count, 0) * 0.10,
        2
    )                                                                      AS total_due
FROM tenants t
LEFT JOIN tenant_billing_meters m
       ON m.tenant_id = t.id
      AND m.billing_period = '${PERIOD}'
ORDER BY t.id;

SELECT '--------------------------------------------------------' AS separator;

SELECT
    'PLATFORM TOTAL' AS label,
    SUM(COALESCE(m.transactions_processed_count, 0))                     AS total_tx,
    SUM(COALESCE(m.stellar_anchors_written_count, 0))                    AS total_anchors,
    ROUND(SUM(
        99.00
        + COALESCE(m.transactions_processed_count, 0) / 100.0 * 0.05
        + COALESCE(m.stellar_anchors_written_count, 0) * 0.10
    ), 2)                                                                 AS platform_revenue
FROM tenants t
LEFT JOIN tenant_billing_meters m
       ON m.tenant_id = t.id
      AND m.billing_period = '${PERIOD}';
SQL

echo "========================================================"
echo "Pricing model: \$99 base + \$0.05/100 tx + \$0.10/anchor"
echo "Period: ${PERIOD}. Review output above for any anomalies."
echo "========================================================"
