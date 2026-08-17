-- =====================================================================
-- 03_camden_data_share.sql
-- Receive the Camden FOI corpus via Snowflake Secure Data Sharing.
--
-- Use this when the source account (where FOI.FOI_SENTINEL_V2 was originally
-- deployed) makes CAMDEN_FOI_RESPONSES available as a share. It is the
-- fastest option and requires no API calls or file handling.
--
-- Prerequisites:
--   The source account must have created an outbound share containing
--   CAMDEN_FOI_RESPONSES and added your account as a consumer.
-- =====================================================================

-- =====================================================================
-- SOURCE ACCOUNT — run these steps in the account that holds the data
-- =====================================================================

-- Step 1: Create the outbound share (source account, ACCOUNTADMIN).
-- Replace RECIPIENT_ACCOUNT with the target Snowflake account identifier
-- (format: <org>.<account>, e.g. SFSEEUROPE.MY_ACCOUNT).

USE ROLE ACCOUNTADMIN;

CREATE SHARE IF NOT EXISTS FOI_CAMDEN_SHARE
    COMMENT = 'Camden FOI corpus for redeployment';

GRANT USAGE ON DATABASE FOI TO SHARE FOI_CAMDEN_SHARE;
GRANT USAGE ON SCHEMA FOI.FOI_SENTINEL_V2 TO SHARE FOI_CAMDEN_SHARE;
GRANT SELECT ON TABLE FOI.FOI_SENTINEL_V2.CAMDEN_FOI_RESPONSES TO SHARE FOI_CAMDEN_SHARE;

ALTER SHARE FOI_CAMDEN_SHARE ADD ACCOUNTS = RECIPIENT_ACCOUNT;

-- Verify the share is configured.
SHOW GRANTS TO SHARE FOI_CAMDEN_SHARE;


-- =====================================================================
-- RECIPIENT ACCOUNT — run these steps in the new deployment account
-- =====================================================================

-- Step 2: Create a database from the incoming share (recipient account).
-- Replace SOURCE_ACCOUNT with the account identifier of the source.

USE ROLE ACCOUNTADMIN;

CREATE DATABASE IF NOT EXISTS CAMDEN_FOI_SHARED
    FROM SHARE SOURCE_ACCOUNT.FOI_CAMDEN_SHARE;

-- Step 3: Grant access to the shared database to the role that runs the app.
GRANT IMPORTED PRIVILEGES ON DATABASE CAMDEN_FOI_SHARED TO ROLE SYSADMIN;

-- Step 4: Copy the shared table into the local FOI schema so the app can
-- query it as FOI.FOI_SENTINEL_V2.CAMDEN_FOI_RESPONSES without any changes
-- to application configuration.
USE ROLE SYSADMIN;
USE DATABASE FOI;
USE SCHEMA FOI_SENTINEL_V2;
USE WAREHOUSE FOI_WH;

CREATE TABLE IF NOT EXISTS CAMDEN_FOI_RESPONSES AS
    SELECT * FROM CAMDEN_FOI_SHARED.FOI_SENTINEL_V2.CAMDEN_FOI_RESPONSES;

-- Verify
SELECT COUNT(*) AS ROWS_COPIED FROM FOI.FOI_SENTINEL_V2.CAMDEN_FOI_RESPONSES;

-- Step 5 (optional): Drop the shared database once the copy is complete.
-- DROP DATABASE IF EXISTS CAMDEN_FOI_SHARED;
