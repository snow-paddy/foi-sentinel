-- =====================================================================
-- FOI Sentinel v2 — Phase 3: Logic layer
-- Working-day maths (bank-holiday aware), stage engine, clock management,
-- cost model (Fees Regs 2004), triage and response procedures.
-- NOTE: inside SQL procedures, parameters/locals are referenced with a
-- leading colon (:P_VAR) when used in SQL statements.
-- =====================================================================
USE WAREHOUSE FOI_WH;
USE SCHEMA FOI.FOI_SENTINEL_V2;

-- ---------------------------------------------------------------------
-- FN_WORKING_DAYS: count working days in (start, end], excl weekends + bank holidays
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION FN_WORKING_DAYS(START_DATE DATE, END_DATE DATE)
RETURNS NUMBER
AS
$$
    SELECT COUNT(*)
    FROM (
        SELECT DATEADD('day', (ROW_NUMBER() OVER (ORDER BY SEQ4())), START_DATE) AS D
        FROM TABLE(GENERATOR(ROWCOUNT => 1000))
    )
    WHERE D <= END_DATE
      AND DAYOFWEEKISO(D) < 6
      AND D NOT IN (SELECT HOLIDAY_DATE FROM UK_BANK_HOLIDAYS)
$$;

-- ---------------------------------------------------------------------
-- FN_ADD_WORKING_DAYS: statutory-deadline calculator
-- Day 1 = first working day AFTER the start (receipt) date.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION FN_ADD_WORKING_DAYS(START_DATE DATE, N NUMBER)
RETURNS DATE
AS
$$
    SELECT D FROM (
        SELECT D, ROW_NUMBER() OVER (ORDER BY D) AS RN FROM (
            SELECT DATEADD('day', (ROW_NUMBER() OVER (ORDER BY SEQ4())), START_DATE) AS D
            FROM TABLE(GENERATOR(ROWCOUNT => 1000))
        )
        WHERE DAYOFWEEKISO(D) < 6
          AND D NOT IN (SELECT HOLIDAY_DATE FROM UK_BANK_HOLIDAYS)
    )
    WHERE RN = N
$$;

-- ---------------------------------------------------------------------
-- FN_WD_REMAINING: signed working days from today to deadline (neg = overdue)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION FN_WD_REMAINING(DEADLINE DATE)
RETURNS NUMBER
AS
$$
    CASE
        WHEN DEADLINE IS NULL THEN NULL
        WHEN DEADLINE >= CURRENT_DATE() THEN FN_WORKING_DAYS(CURRENT_DATE(), DEADLINE)
        ELSE -1 * FN_WORKING_DAYS(DEADLINE, CURRENT_DATE())
    END
$$;
