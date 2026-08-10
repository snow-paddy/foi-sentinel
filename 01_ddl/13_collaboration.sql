-- =====================================================================
-- 13_collaboration.sql
-- Task 7: multi-user collaboration state on Hybrid Tables (Unistore).
--
-- Why Hybrid Tables: assignment/claim/sign-off are OLTP-shaped (many small
-- single-row read-modify-writes). Standard tables take partition-level locks
-- and enforce no uniqueness, so two officers can claim the same case and
-- concurrent edits lose updates. Hybrid Tables give row-level locking and an
-- ENFORCED UNIQUE(CASE_ID), which is the guarantee this feature rests on.
--
-- Design notes:
--  * IDs are VARCHAR + DEFAULT UUID_STRING() — Hybrid Tables have no UUID type.
--  * No cross-table FKs to the standard FOI_CASE / FOI_OFFICER tables: a hybrid
--    FK requires an enforced parent key, which the standard tables don't have.
--    References are logical (plain VARCHAR); the PK + UNIQUE on the hybrid
--    tables themselves carry the correctness that matters.
--  * Procedures are EXECUTE AS OWNER and $$-quoted so `snow sql -f` can't shred
--    the bodies on semicolons. Params are colon-prefixed inside SQL.
--  * Additive only — no CREATE OR REPLACE over existing tables.
-- =====================================================================

USE WAREHOUSE FOI_WH;
USE SCHEMA FOI.FOI_SENTINEL_V2;

-- ---------------------------------------------------------------------
-- One ACTIVE assignment per case. UNIQUE(CASE_ID) is the no-double-claim
-- guarantee: a second CLAIM insert for the same case fails on the constraint.
-- Reassignment (by a manager) updates the row; release deletes it.
-- ---------------------------------------------------------------------
CREATE HYBRID TABLE IF NOT EXISTS FOI_CASE_ASSIGNMENT (
  ASSIGNMENT_ID  VARCHAR       NOT NULL DEFAULT UUID_STRING(),
  CASE_ID        VARCHAR       NOT NULL,
  REFERENCE      VARCHAR,
  OFFICER_ID     VARCHAR       NOT NULL,
  OFFICER_NAME   VARCHAR,
  PERSONA        VARCHAR,
  ASSIGNED_BY    VARCHAR,
  ASSIGNED_AT    TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  STATUS         VARCHAR       NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT PK_FOI_CASE_ASSIGNMENT PRIMARY KEY (ASSIGNMENT_ID),
  CONSTRAINT UQ_FOI_CASE_ASSIGNMENT_CASE UNIQUE (CASE_ID),
  INDEX IDX_FOI_CASE_ASSIGNMENT_OFFICER (OFFICER_ID)
);

-- ---------------------------------------------------------------------
-- Soft edit-lock, one per case. EXPIRES_AT lets a stale lock self-clear so a
-- crashed session can't wedge a case permanently.
-- ---------------------------------------------------------------------
CREATE HYBRID TABLE IF NOT EXISTS FOI_CASE_LOCK (
  CASE_ID        VARCHAR       NOT NULL,
  LOCKED_BY      VARCHAR       NOT NULL,
  LOCKED_BY_NAME VARCHAR,
  LOCKED_AT      TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  EXPIRES_AT     TIMESTAMP_NTZ,
  CONSTRAINT PK_FOI_CASE_LOCK PRIMARY KEY (CASE_ID)
);

-- ---------------------------------------------------------------------
-- Append-only sign-off chain (officer draft -> reviewer -> monitoring).
-- Each transition is one immutable row: actor, role, decision, time.
-- ---------------------------------------------------------------------
CREATE HYBRID TABLE IF NOT EXISTS FOI_SIGNOFF (
  SIGNOFF_ID  VARCHAR       NOT NULL DEFAULT UUID_STRING(),
  CASE_ID     VARCHAR       NOT NULL,
  REFERENCE   VARCHAR,
  STEP        VARCHAR       NOT NULL,
  ACTOR       VARCHAR       NOT NULL,
  ROLE        VARCHAR,
  DECISION    VARCHAR       NOT NULL,
  NOTE        VARCHAR,
  AT          TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  CONSTRAINT PK_FOI_SIGNOFF PRIMARY KEY (SIGNOFF_ID),
  INDEX IDX_FOI_SIGNOFF_CASE (CASE_ID)
);

-- ---------------------------------------------------------------------
-- SP_CLAIM_CASE — first-come claim. Relies on UNIQUE(CASE_ID): a second
-- claimant hits the constraint, and we return who already holds it rather
-- than an error. This is the row-level guarantee standard tables can't give.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_CLAIM_CASE(
  P_CASE_ID VARCHAR, P_REFERENCE VARCHAR, P_OFFICER_ID VARCHAR,
  P_OFFICER_NAME VARCHAR, P_PERSONA VARCHAR, P_ACTOR VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
DECLARE
  held_by      VARCHAR;
  held_persona VARCHAR;
BEGIN
  INSERT INTO FOI_CASE_ASSIGNMENT (CASE_ID, REFERENCE, OFFICER_ID, OFFICER_NAME, PERSONA, ASSIGNED_BY)
  VALUES (:P_CASE_ID, :P_REFERENCE, :P_OFFICER_ID, :P_OFFICER_NAME, :P_PERSONA, :P_ACTOR);
  RETURN OBJECT_CONSTRUCT('ok', TRUE, 'officer_name', :P_OFFICER_NAME);
EXCEPTION
  WHEN OTHER THEN
    SELECT OFFICER_NAME, PERSONA INTO :held_by, :held_persona
      FROM FOI_CASE_ASSIGNMENT WHERE CASE_ID = :P_CASE_ID;
    RETURN OBJECT_CONSTRUCT('ok', FALSE, 'held_by', :held_by, 'held_by_persona', :held_persona);
END;
$$;

-- ---------------------------------------------------------------------
-- SP_ASSIGN_CASE — reassign (upsert). Used by a manager to (re)assign a case
-- to any officer regardless of who currently holds it.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_ASSIGN_CASE(
  P_CASE_ID VARCHAR, P_REFERENCE VARCHAR, P_OFFICER_ID VARCHAR,
  P_OFFICER_NAME VARCHAR, P_PERSONA VARCHAR, P_ASSIGNED_BY VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
BEGIN
  MERGE INTO FOI_CASE_ASSIGNMENT t
  USING (SELECT :P_CASE_ID AS CASE_ID) s
  ON t.CASE_ID = s.CASE_ID
  WHEN MATCHED THEN UPDATE SET
    OFFICER_ID = :P_OFFICER_ID, OFFICER_NAME = :P_OFFICER_NAME, PERSONA = :P_PERSONA,
    ASSIGNED_BY = :P_ASSIGNED_BY, ASSIGNED_AT = CURRENT_TIMESTAMP(), STATUS = 'ACTIVE',
    REFERENCE = :P_REFERENCE
  WHEN NOT MATCHED THEN INSERT (CASE_ID, REFERENCE, OFFICER_ID, OFFICER_NAME, PERSONA, ASSIGNED_BY)
    VALUES (:P_CASE_ID, :P_REFERENCE, :P_OFFICER_ID, :P_OFFICER_NAME, :P_PERSONA, :P_ASSIGNED_BY);
  RETURN OBJECT_CONSTRUCT('ok', TRUE, 'officer_name', :P_OFFICER_NAME);
END;
$$;

-- ---------------------------------------------------------------------
-- SP_RELEASE_CASE — drop the active assignment (case returns to unassigned).
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_RELEASE_CASE(P_CASE_ID VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
BEGIN
  DELETE FROM FOI_CASE_ASSIGNMENT WHERE CASE_ID = :P_CASE_ID;
  RETURN OBJECT_CONSTRUCT('ok', TRUE);
END;
$$;

-- ---------------------------------------------------------------------
-- SP_SUBMIT_SIGNOFF — append one immutable sign-off step.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_SUBMIT_SIGNOFF(
  P_CASE_ID VARCHAR, P_REFERENCE VARCHAR, P_STEP VARCHAR,
  P_ACTOR VARCHAR, P_ROLE VARCHAR, P_DECISION VARCHAR, P_NOTE VARCHAR)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
BEGIN
  INSERT INTO FOI_SIGNOFF (CASE_ID, REFERENCE, STEP, ACTOR, ROLE, DECISION, NOTE)
  VALUES (:P_CASE_ID, :P_REFERENCE, :P_STEP, :P_ACTOR, :P_ROLE, :P_DECISION, :P_NOTE);
  RETURN OBJECT_CONSTRUCT('ok', TRUE);
END;
$$;
