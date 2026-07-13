-- =====================================================================
-- FOI Sentinel v2 — Step 0: bootstrap (database + warehouse)
-- Run this FIRST, as a role that can create account objects (ACCOUNTADMIN).
-- Every later script assumes FOI and FOI_WH already exist. Idempotent.
-- =====================================================================
USE ROLE ACCOUNTADMIN;

-- Warehouse the setup scripts and the app query through.
CREATE WAREHOUSE IF NOT EXISTS FOI_WH
    WAREHOUSE_SIZE = 'XSMALL'
    AUTO_SUSPEND = 60
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'FOI Sentinel compute';

-- Application database and schemas.
CREATE DATABASE IF NOT EXISTS FOI;
CREATE SCHEMA IF NOT EXISTS FOI.FOI_SENTINEL_V2;  -- data model, KBs, SAR, audit
CREATE SCHEMA IF NOT EXISTS FOI.APPS;             -- install target for the SPCS app

-- Optional: generative Cortex and tuned models require cross-region inference
-- in regions without them natively (for example, London is extract/embed only).
-- Uncomment and set the value appropriate to your account if a Cortex call
-- returns a "model not available in region" error.
-- ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'AWS_US';

USE WAREHOUSE FOI_WH;
USE DATABASE FOI;
USE SCHEMA FOI_SENTINEL_V2;
