-- =====================================================================
-- FOI Sentinel v2 - WhatDoTheyKnow corpus theme summary (AI_AGG)
-- A natural-language summary of the common themes across the peer FOI
-- corpus, computed once with AI_AGG and cached in a 1-row table so the
-- Sector Trends page reads it cheaply. Refresh on demand.
-- =====================================================================
USE WAREHOUSE FOI_WH; USE SCHEMA FOI.FOI_SENTINEL_V2;

CREATE TABLE IF NOT EXISTS WDTK_THEME_SUMMARY (
    SUMMARY_TEXT  VARCHAR,
    N_EVENTS      NUMBER,
    COMPUTED_AT   TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE PROCEDURE SP_REFRESH_WDTK_SUMMARY()
RETURNS STRING LANGUAGE SQL AS
BEGIN
    -- Bound the aggregation to a recent sample to keep the refresh fast.
    LET v_summary VARCHAR := (
        SELECT AI_AGG(
            REQUEST_TITLE,
            'You are a UK local-government FOI analyst. In 3 to 4 sentences, summarise the most common themes and subjects in these public FOI request titles, and note which topics recur most. Use British English. Do not list every title.'
        )
        FROM (
            SELECT REQUEST_TITLE FROM WDTK_EVENT
            WHERE REQUEST_TITLE IS NOT NULL
            ORDER BY CREATED_AT DESC NULLS LAST
            LIMIT 400
        )
    );
    LET v_n INTEGER := (SELECT COUNT(*) FROM WDTK_EVENT WHERE REQUEST_TITLE IS NOT NULL);
    DELETE FROM WDTK_THEME_SUMMARY;
    INSERT INTO WDTK_THEME_SUMMARY (SUMMARY_TEXT, N_EVENTS, COMPUTED_AT)
        VALUES (:v_summary, :v_n, CURRENT_TIMESTAMP());
    RETURN 'WDTK theme summary refreshed over a sample of the ' || :v_n || ' corpus events.';
END;

CALL SP_REFRESH_WDTK_SUMMARY();
