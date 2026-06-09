#!/usr/bin/env bash
# db/verify.sh — Phase 1 Definition-of-Done gate.
# Confirms the schema built cleanly, seed data loaded, and that a sample row
# flows through the materialized summary and the trend-analysis view.
#
# Usage (after `docker compose -f docker-compose.db.yml up -d`):
#   bash db/verify.sh
set -euo pipefail

DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-tlaas_ledger}"
PSQL="docker exec -i tlaas_db psql -v ON_ERROR_STOP=1 -U ${DB_USER} -d ${DB_NAME} -t -A"

echo "== 1. Object inventory =="
$PSQL -c "SELECT 'tables: '   || count(*) FROM information_schema.tables  WHERE table_schema='public' AND table_type='BASE TABLE';"
$PSQL -c "SELECT 'views: '    || count(*) FROM information_schema.views   WHERE table_schema='public';"
$PSQL -c "SELECT 'matviews: ' || count(*) FROM pg_matviews              WHERE schemaname='public';"

echo "== 2. Seed checks =="
$PSQL -c "SELECT 'industries: '   || count(*) FROM industries;"            # expect 4
$PSQL -c "SELECT 'ruleset rows: ' || count(*) FROM industry_mcc_ruleset;"  # expect 64
$PSQL -c "SELECT 'vendor rules: '|| count(*) FROM vendor_category_rules;"   # expect 6
$PSQL -c "SELECT 'mcc_reference: '|| count(*) FROM mcc_reference;"          # expect 16
$PSQL -c "SELECT 'tenants: '      || count(*) FROM tenants;"               # expect 1

echo "== 3. Insert two sample months for the demo tenant =="
$PSQL <<'SQL'
WITH t AS (SELECT id FROM tenants WHERE slug='demo-auto')
INSERT INTO repay_payment_ledger
    (tenant_id, payment_number, invoice_numbers, vendor_number, vendor_name,
     mcc_code, payment_mechanism, assigned_category, total_amount, payment_status,
     creation_date, status_date)
SELECT t.id, p.pnum, p.invs, p.vnum, p.vname, p.mcc, p.mech, p.cat, p.amt, 'Settled',
       p.cdate::timestamptz, p.cdate::timestamptz
FROM t, (VALUES
    ('WP100', ARRAY['AS1','AS2'], 'WP1', 'DECKER AUTO', 5533, 'VirtualCard', 'Inventory Sourcing', 1000.00, '2026-04-10'),
    ('WP101', ARRAY['AS3'],       'WP2', 'INTERSTATE',  5072, 'ACH',         'Shop Tools & Equipment', 500.00,  '2026-04-12'),
    ('WP200', ARRAY['AS4'],       'WP1', 'DECKER AUTO', 5533, 'VirtualCard', 'Inventory Sourcing', 1100.00, '2026-05-10'),
    ('WP300', ARRAY['AS5'],       'WP1', 'DECKER AUTO', 5533, 'VirtualCard', 'Inventory Sourcing', 5000.00, '2026-06-10')
) AS p(pnum, invs, vnum, vname, mcc, mech, cat, amt, cdate)
ON CONFLICT (payment_number) DO NOTHING;
SQL

echo "== 4. Refresh the materialized summary =="
$PSQL -c "REFRESH MATERIALIZED VIEW mv_tenant_monthly_summary;"
$PSQL -c "SELECT report_month, assigned_category, total_monthly_spend FROM mv_tenant_monthly_summary ORDER BY report_month, assigned_category;"

echo "== 5. Trend analysis (expect the June Inventory row flagged SPIKE) =="
$PSQL -c "SELECT report_month, assigned_category, total_monthly_spend, rolling_3_month_avg, mom_percent_change, anomaly_status FROM vw_trend_analysis ORDER BY assigned_category, report_month;"

echo
echo "✅ Phase 1 gate passed if: 9 tables, 1 view, 1 matview, seeds match, and the"
echo "   June 'Inventory Sourcing' row (5000 vs ~2367 rolling baseline, >1.5x) shows anomaly_status = SPIKE."
