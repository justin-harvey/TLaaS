-- ============================================================================
--  TLaaS  ·  db/init.sql
--  Phase 1 deliverable — Core Ledger Database Cache & Schema
--
--  Auto-mounted by docker-compose at /docker-entrypoint-initdb.d/init.sql,
--  so it runs once on first container boot.
--
--  Build order matters: extensions -> reference tables -> tenants ->
--  ruleset -> ledger cache -> anchor log -> audit -> metering ->
--  views -> seed data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- SHA-256 digests for integrity checks

-- Shared trigger helper: stamps a row's "updated" column on write.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- 1. Industries  (vertical templates that drive MCC categorisation)
-- ---------------------------------------------------------------------------
CREATE TABLE industries (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL   -- 'Automotive', 'Healthcare', ...
);


-- ---------------------------------------------------------------------------
-- 2. Tenants  (the customers: auto shops, clinics, utilities, cities)
-- ---------------------------------------------------------------------------
CREATE TABLE tenants (
    id                    SERIAL PRIMARY KEY,
    company_name          VARCHAR(255) NOT NULL,
    slug                  VARCHAR(100) UNIQUE NOT NULL,        -- clean URL: /ledger/<slug>
    industry_id           INT REFERENCES industries(id),       -- sets the ruleset context
    stellar_admin_address VARCHAR(56) UNIQUE NOT NULL,          -- G... address allowed to sign overrides
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ---------------------------------------------------------------------------
-- 3. Global MCC reference  (the ISO standard descriptions — onboarding clarity)
-- ---------------------------------------------------------------------------
CREATE TABLE mcc_reference (
    mcc_code             INT PRIMARY KEY,
    official_description TEXT NOT NULL
);


-- ---------------------------------------------------------------------------
-- 4. Industry-specific MCC ruleset  (the proprietary "semantic layer")
--    Same raw MCC routes to different dashboard buckets per vertical.
-- ---------------------------------------------------------------------------
CREATE TABLE industry_mcc_ruleset (
    id                SERIAL PRIMARY KEY,
    industry_id       INT NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
    mcc_code          INT NOT NULL,
    assigned_category VARCHAR(100) NOT NULL,
    CONSTRAINT unique_industry_mcc UNIQUE (industry_id, mcc_code)
);
CREATE INDEX idx_ruleset_lookup ON industry_mcc_ruleset(industry_id, mcc_code);


-- ---------------------------------------------------------------------------
-- 4b. Vendor-name category rules (Phase 2.5 — RePay path has no MCC)
--     Maps an uppercased vendor-name substring to a dashboard category,
--     scoped per industry. Lower priority value = checked first.
-- ---------------------------------------------------------------------------
CREATE TABLE vendor_category_rules (
    id                SERIAL PRIMARY KEY,
    industry_id       INT NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
    match_substring   VARCHAR(255) NOT NULL,
    assigned_category VARCHAR(100) NOT NULL,
    priority          INT DEFAULT 100,
    CONSTRAINT unique_industry_substring UNIQUE (industry_id, match_substring)
);
CREATE INDEX idx_vendor_rules_lookup ON vendor_category_rules(industry_id, priority);


-- ---------------------------------------------------------------------------
-- 5. Ledger cache  (the read-optimised heart of the dashboard)
--    Column set matches the Phase 2 ingestion INSERT exactly, plus a
--    nullable mcc_code so the Plaid path can retain the raw banking code.
-- ---------------------------------------------------------------------------
CREATE TABLE repay_payment_ledger (
    id                     BIGSERIAL PRIMARY KEY,
    tenant_id              INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Transaction identifiers (from the RePay flat-file UI)
    payment_number         VARCHAR(100) UNIQUE NOT NULL,   -- e.g. 'WP63620260603'
    invoice_numbers        TEXT[] NOT NULL,                -- multi-invoice rows: ['AS1719354','AS1718958']
    vendor_number          VARCHAR(50) NOT NULL,
    vendor_name            VARCHAR(255) NOT NULL,

    -- Categorisation & presentation
    mcc_code               INT,                            -- nullable: present on Plaid feeds, absent on RePay
    payment_mechanism      VARCHAR(50) NOT NULL,           -- VirtualCard, ACH, EFT, Check/Cheque
    assigned_category      VARCHAR(100) NOT NULL,          -- set via the industry ruleset / vendor map
    is_manually_overridden BOOLEAN DEFAULT FALSE,

    -- Financial vectors
    total_amount           NUMERIC(12,2) NOT NULL,
    available_amount       NUMERIC(12,2) DEFAULT 0.00,
    payment_status         VARCHAR(50) NOT NULL,           -- Pending, Settled, Voided

    -- Audit / pipeline timestamps
    creation_date          TIMESTAMP WITH TIME ZONE NOT NULL,
    status_date            TIMESTAMP WITH TIME ZONE NOT NULL,
    ingested_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT amount_non_negative CHECK (total_amount > 0)   -- public expense ledgers reject <= 0
);

-- High-performance indexes (sub-second "Tableau-like" loads)
CREATE INDEX idx_ledger_tenant_date      ON repay_payment_ledger(tenant_id, creation_date);
CREATE INDEX idx_ledger_tenant_category  ON repay_payment_ledger(tenant_id, assigned_category);
CREATE INDEX idx_ledger_tenant_mechanism ON repay_payment_ledger(tenant_id, payment_mechanism);
CREATE INDEX idx_ledger_invoice_search   ON repay_payment_ledger USING GIN (invoice_numbers);


-- ---------------------------------------------------------------------------
-- 6. Stellar anchor verification log
--    One settled period per tenant; the indexer (Phase 4) populates this from
--    confirmed on-chain events. UNIQUE prevents double-anchoring a period.
-- ---------------------------------------------------------------------------
CREATE TABLE stellar_anchors (
    id               SERIAL PRIMARY KEY,
    tenant_id        INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    month_key        VARCHAR(7) NOT NULL,           -- 'YYYY-MM'
    stellar_tx_hash  CHAR(64) NOT NULL,             -- on-chain transaction hash
    ipfs_cid         VARCHAR(100) NOT NULL,         -- off-chain payload pointer
    calculated_sha256 CHAR(64) NOT NULL,            -- fingerprint anchored on-chain
    is_verified      BOOLEAN DEFAULT FALSE,         -- set when cache re-hash matches
    verified_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_month UNIQUE (tenant_id, month_key)
);
CREATE INDEX idx_anchors_lookup ON stellar_anchors(tenant_id, month_key);


-- ---------------------------------------------------------------------------
-- 7. Admin override audit log  (every signed reclassification, immutable trail)
-- ---------------------------------------------------------------------------
CREATE TABLE admin_override_audit_logs (
    id                   BIGSERIAL PRIMARY KEY,
    tenant_id            INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ledger_row_id        BIGINT REFERENCES repay_payment_ledger(id) ON DELETE SET NULL,
    admin_address        VARCHAR(56) NOT NULL,      -- signer's Stellar G... address
    previous_category    VARCHAR(100),
    new_category         VARCHAR(100) NOT NULL,
    signed_intent        TEXT NOT NULL,             -- the signed statement payload
    signature            TEXT NOT NULL,             -- ECDSA signature verified server-side
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_override_tenant ON admin_override_audit_logs(tenant_id, created_at);


-- ---------------------------------------------------------------------------
-- 8. Usage metering  (drives the consumption-based billing model)
-- ---------------------------------------------------------------------------
CREATE TABLE tenant_billing_meters (
    id                            SERIAL PRIMARY KEY,
    tenant_id                     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    billing_period                VARCHAR(7) NOT NULL,        -- 'YYYY-MM'
    transactions_processed_count  INT DEFAULT 0,
    stellar_anchors_written_count INT DEFAULT 0,
    last_updated_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_period UNIQUE (tenant_id, billing_period)
);
CREATE INDEX idx_billing_meters_lookup ON tenant_billing_meters(tenant_id, billing_period);

CREATE TRIGGER trg_meters_updated
    BEFORE UPDATE ON tenant_billing_meters
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------------------------
-- 9. Materialized summary  (pre-aggregated so dashboards never scan raw rows)
--    Refresh after each ingest:  REFRESH MATERIALIZED VIEW CONCURRENTLY ...
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_tenant_monthly_summary AS
SELECT
    tenant_id,
    assigned_category,
    date_trunc('month', creation_date)::date AS report_month,
    SUM(total_amount)                        AS total_monthly_spend,
    COUNT(*)                                 AS transaction_count
FROM repay_payment_ledger
GROUP BY tenant_id, assigned_category, date_trunc('month', creation_date);

-- UNIQUE index is required to allow CONCURRENT refresh.
CREATE UNIQUE INDEX idx_mv_summary
    ON mv_tenant_monthly_summary(tenant_id, assigned_category, report_month);


-- ---------------------------------------------------------------------------
-- 10. Analysis view  (rolling 3-month average, MoM %, SPIKE/DROP anomaly flag)
-- ---------------------------------------------------------------------------
CREATE VIEW vw_trend_analysis AS
WITH monthly_aggregates AS (
    SELECT
        tenant_id,
        assigned_category,
        date_trunc('month', creation_date)::date AS report_month,
        SUM(total_amount)                        AS total_monthly_spend,
        COUNT(*)                                 AS transaction_count
    FROM repay_payment_ledger
    GROUP BY tenant_id, assigned_category, date_trunc('month', creation_date)
),
trend AS (
    SELECT
        tenant_id,
        assigned_category,
        report_month,
        total_monthly_spend,
        transaction_count,
        AVG(total_monthly_spend) OVER (
            PARTITION BY tenant_id, assigned_category
            ORDER BY report_month
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS rolling_3_month_avg,
        LAG(total_monthly_spend, 1) OVER (
            PARTITION BY tenant_id, assigned_category
            ORDER BY report_month
        ) AS prior_month_spend
    FROM monthly_aggregates
)
SELECT
    tenant_id,
    assigned_category,
    report_month,
    total_monthly_spend,
    transaction_count,
    ROUND(rolling_3_month_avg, 2) AS rolling_3_month_avg,
    CASE
        WHEN prior_month_spend IS NULL OR prior_month_spend = 0 THEN 0.00
        ELSE ROUND(((total_monthly_spend - prior_month_spend) / prior_month_spend) * 100, 2)
    END AS mom_percent_change,
    CASE
        WHEN total_monthly_spend > (rolling_3_month_avg * 1.50) THEN 'SPIKE'
        WHEN total_monthly_spend < (rolling_3_month_avg * 0.50) THEN 'DROP'
        ELSE 'STABLE'
    END AS anomaly_status
FROM trend;


-- ============================================================================
--  SEED DATA
-- ============================================================================

-- 11a. Industry verticals
INSERT INTO industries (name) VALUES
    ('Automotive'),
    ('Healthcare'),
    ('Public Utilities'),
    ('Municipal');

-- 11b. Global MCC reference descriptions (from Appendix B mapping matrix)
INSERT INTO mcc_reference (mcc_code, official_description) VALUES
    (5511, 'Automobile and Truck Dealers (New & Used)'),
    (5521, 'Automobile and Truck Dealers (Used Only)'),
    (5533, 'Automotive Parts and Accessories Stores'),
    (5072, 'Hardware Equipment and Supplies'),
    (5251, 'Hardware Stores'),
    (4900, 'Utilities: Electric, Gas, Water, Sanitary'),
    (8011, 'Doctors and Physicians'),
    (8021, 'Dentists and Orthodontists'),
    (8099, 'Medical Services and Health Practitioners'),
    (4812, 'Telecommunication Equipment and Sales'),
    (4814, 'Telecommunication Services'),
    (4816, 'Computer Network / Information Services'),
    (9211, 'Court Costs, including Alimony and Child Support'),
    (9399, 'Government Services (Not Elsewhere Classified)'),
    (5111, 'Stationery, Office Supplies, Printing'),
    (5943, 'Office, School Supply and Stationery Stores');

-- 11c. Industry-specific routing ruleset (Appendix B mapping matrix)
INSERT INTO industry_mcc_ruleset (industry_id, mcc_code, assigned_category)
SELECT i.id, v.mcc_code, v.assigned_category
FROM industries i
JOIN (VALUES
    -- Auto dealers, parts & supply
    ('Automotive',       5511, 'Inventory Sourcing'),
    ('Automotive',       5521, 'Inventory Sourcing'),
    ('Automotive',       5533, 'Inventory Sourcing'),
    ('Healthcare',       5511, 'Fleet Operations'),
    ('Healthcare',       5521, 'Fleet Operations'),
    ('Healthcare',       5533, 'Fleet Operations'),
    ('Public Utilities', 5511, 'Vehicle Maintenance'),
    ('Public Utilities', 5521, 'Vehicle Maintenance'),
    ('Public Utilities', 5533, 'Vehicle Maintenance'),
    ('Municipal',        5511, 'Fleet Operations'),
    ('Municipal',        5521, 'Fleet Operations'),
    ('Municipal',        5533, 'Fleet Operations'),
    -- Hardware, tools & building materials
    ('Automotive',       5072, 'Shop Tools & Equipment'),
    ('Automotive',       5251, 'Shop Tools & Equipment'),
    ('Healthcare',       5072, 'Facilities Overhead'),
    ('Healthcare',       5251, 'Facilities Overhead'),
    ('Public Utilities', 5072, 'Grid Deployment / Capex'),
    ('Public Utilities', 5251, 'Grid Deployment / Capex'),
    ('Municipal',        5072, 'Infrastructure Maintenance'),
    ('Municipal',        5251, 'Infrastructure Maintenance'),
    -- Utilities (electric/water/gas)
    ('Automotive',       4900, 'Facilities Overhead'),
    ('Healthcare',       4900, 'Facilities Overhead'),
    ('Public Utilities', 4900, 'Wholesale Power & Grid'),
    ('Municipal',        4900, 'Public Utility Allocations'),
    -- Medical services
    ('Automotive',       8011, 'Employee Wellness'),
    ('Automotive',       8021, 'Employee Wellness'),
    ('Automotive',       8099, 'Employee Wellness'),
    ('Healthcare',       8011, 'Direct Patient Care'),
    ('Healthcare',       8021, 'Direct Patient Care'),
    ('Healthcare',       8099, 'Direct Patient Care'),
    ('Public Utilities', 8011, 'Employee Benefits'),
    ('Public Utilities', 8021, 'Employee Benefits'),
    ('Public Utilities', 8099, 'Employee Benefits'),
    ('Municipal',        8011, 'Community Health Services'),
    ('Municipal',        8021, 'Community Health Services'),
    ('Municipal',        8099, 'Community Health Services'),
    -- Telecom / data / network
    ('Automotive',       4812, 'IT Overhead'),
    ('Automotive',       4814, 'IT Overhead'),
    ('Automotive',       4816, 'IT Overhead'),
    ('Healthcare',       4812, 'IT Infrastructure'),
    ('Healthcare',       4814, 'IT Infrastructure'),
    ('Healthcare',       4816, 'IT Infrastructure'),
    ('Public Utilities', 4812, 'Grid Telemetry & Comms'),
    ('Public Utilities', 4814, 'Grid Telemetry & Comms'),
    ('Public Utilities', 4816, 'Grid Telemetry & Comms'),
    ('Municipal',        4812, 'Municipal IT & Telecom'),
    ('Municipal',        4814, 'Municipal IT & Telecom'),
    ('Municipal',        4816, 'Municipal IT & Telecom'),
    -- Court costs, fees & government services
    ('Automotive',       9211, 'Regulatory Licensing'),
    ('Automotive',       9399, 'Regulatory Licensing'),
    ('Healthcare',       9211, 'Compliance Licensing'),
    ('Healthcare',       9399, 'Compliance Licensing'),
    ('Public Utilities', 9211, 'Regulatory Tariffs'),
    ('Public Utilities', 9399, 'Regulatory Tariffs'),
    ('Municipal',        9211, 'Intergovernmental Transfers'),
    ('Municipal',        9399, 'Intergovernmental Transfers'),
    -- Office supplies & stationery
    ('Automotive',       5111, 'Office Administration'),
    ('Automotive',       5943, 'Office Administration'),
    ('Healthcare',       5111, 'Clinic Admin Supplies'),
    ('Healthcare',       5943, 'Clinic Admin Supplies'),
    ('Public Utilities', 5111, 'Office Overhead'),
    ('Public Utilities', 5943, 'Office Overhead'),
    ('Municipal',        5111, 'Departmental Supplies'),
    ('Municipal',        5943, 'Departmental Supplies')
) AS v(industry_name, mcc_code, assigned_category)
ON i.name = v.industry_name;

-- 11d. Vendor-name rules (Phase 2.5). Documented blueprint mappings.
INSERT INTO vendor_category_rules (industry_id, match_substring, assigned_category, priority)
SELECT i.id, v.match_substring, v.assigned_category, v.priority
FROM industries i
JOIN (VALUES
    ('Automotive', 'DECKER AUTO', 'Inventory Sourcing',           10),
    ('Automotive', 'INTERSTATE',  'Shop Tools & Battery Supplies', 10),
    ('Automotive', 'FEDEX',       'Shipping Logistics',            20),
    ('Municipal',  'RECYCLING',   'Sanitation & Infrastructure',   10),
    ('Municipal',  'FEDEX',       'Departmental Postage',          20),
    ('Municipal',  'DECKER AUTO', 'Fleet Maintenance',             10)
) AS v(industry_name, match_substring, assigned_category, priority)
ON i.name = v.industry_name;

-- 11e. A demo tenant so the DoD smoke test has something to query.
INSERT INTO tenants (company_name, slug, industry_id, stellar_admin_address)
SELECT 'Demo Auto Group', 'demo-auto', i.id,
       'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADEMO'
FROM industries i WHERE i.name = 'Automotive';

-- ============================================================================
--  END init.sql
-- ============================================================================
