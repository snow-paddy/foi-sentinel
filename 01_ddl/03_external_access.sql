-- =====================================================================
-- External web access for server-side scraping
-- Network rule + External Access Integration (EAI) for the public FOI
-- sources we ingest server-side: GLA disclosure log and ICO decision
-- notices. WhatDoTheyKnow (WDTK) is included only so the egress spike
-- can confirm it is bot-protected (expected 403) and the constraint is
-- documented rather than assumed.
-- Requires ACCOUNTADMIN.
-- =====================================================================
USE ROLE ACCOUNTADMIN;
USE DATABASE FOI;
USE SCHEMA FOI_SENTINEL_V2;

-- Egress allow-list (host:port). 443 for HTTPS.
CREATE OR REPLACE NETWORK RULE FOI_WEB_NETWORK_RULE
  MODE = EGRESS
  TYPE = HOST_PORT
  VALUE_LIST = (
    'www.london.gov.uk:443',
    'london.gov.uk:443',
    'ico.org.uk:443',
    'www.ico.org.uk:443',
    'www.whatdotheyknow.com:443'
  );

CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION FOI_WEB_EAI
  ALLOWED_NETWORK_RULES = (FOI_WEB_NETWORK_RULE)
  ENABLED = TRUE
  COMMENT = 'Outbound HTTPS for FOI Sentinel server-side scrapers (GLA, ICO). WDTK for egress test only.';

-- ---------------------------------------------------------------------
-- Egress spike: record live reachability for all three sources so the
-- WDTK Cloudflare constraint is documented, not assumed.
-- Verified 2026-06-25: WDTK HTTP 403 (blocked) | GLA HTTP 200 | ICO HTTP 200.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_WDTK_EGRESS_TEST()
  RETURNS VARCHAR
  LANGUAGE PYTHON
  RUNTIME_VERSION = '3.11'
  HANDLER = 'run'
  EXTERNAL_ACCESS_INTEGRATIONS = (FOI_WEB_EAI)
  PACKAGES = ('snowflake-snowpark-python', 'requests')
AS
$$
import requests

def run(session):
    targets = [
        ('WDTK', 'https://www.whatdotheyknow.com/feed/search/council.json'),
        ('GLA',  'https://www.london.gov.uk/who-we-are/governance-and-spending/sharing-our-information/foi-disclosure-log'),
        ('ICO',  'https://ico.org.uk/action-weve-taken/decision-notices/'),
    ]
    out = []
    for name, url in targets:
        try:
            r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (FOI-Sentinel egress test)'}, timeout=25)
            out.append(f"{name}: HTTP {r.status_code} len={len(r.text or '')}")
        except Exception as e:
            out.append(f"{name}: ERROR {type(e).__name__}")
    return ' | '.join(out)
$$;

CALL SP_WDTK_EGRESS_TEST();
