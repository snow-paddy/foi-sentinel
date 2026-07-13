-- =====================================================================
-- Server-side web scrapers (on-demand, triggered from Settings)
-- GLA disclosure log + ICO decision notices. Uses FOI_WEB_EAI.
-- Polite: sequential fetches, short timeout, recent-window scoped.
-- =====================================================================
USE ROLE ACCOUNTADMIN;
USE DATABASE FOI;
USE SCHEMA FOI_SENTINEL_V2;

-- ---------------------------------------------------------------------
-- GLA disclosure log scraper
--   P_MAX_PAGES  : listing pages to walk (20 entries/page, newest first)
--   P_MONTHS_BACK: only keep entries with a response date within N months
-- Returns a short summary string (new / updated / scanned).
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE SP_SCRAPE_GLA_DISCLOSURE_LOG(P_MAX_PAGES INT, P_MONTHS_BACK INT)
  RETURNS VARCHAR
  LANGUAGE PYTHON
  RUNTIME_VERSION = '3.11'
  HANDLER = 'run'
  EXTERNAL_ACCESS_INTEGRATIONS = (FOI_WEB_EAI)
  PACKAGES = ('snowflake-snowpark-python', 'requests', 'beautifulsoup4')
AS
$$
import requests, re
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

BASE = 'https://www.london.gov.uk'
LIST_PATH = '/who-we-are/governance-and-spending/sharing-our-information/foi-disclosure-log'
HEADERS = {'User-Agent': 'Mozilla/5.0 (FOI-Sentinel disclosure-log reader; public data re-use)'}
MONTHS = {m: i for i, m in enumerate(
    ['January','February','March','April','May','June','July','August','September','October','November','December'], start=1)}

THEME_KEYWORDS = [
    ('eir_environmental', ['environmental information regulations', 'air quality', 'emission', 'pollution', 'biodiversity', 'contaminated land']),
    ('s40_personal',      ['personal data', 'personal information', 'staff names', 'data protection act', 'section 40']),
    ('s43_commercial',    ['commercial interest', 'contract value', 'tender', 'procurement', 'trade secret', 'section 43']),
    ('s12_cost',          ['cost limit', 'appropriate limit', 'exceeds the cost', 'section 12']),
    ('s14_vexatious',     ['vexatious', 'repeated request', 'section 14']),
    ('s21_published',     ['already published', 'publicly available', 'available on our website', 'section 21']),
]

def classify_theme(regime, text):
    t = (text or '').lower()
    for theme, kws in THEME_KEYWORDS:
        if any(k in t for k in kws):
            return theme
    return 'eir_environmental' if regime == 'EIR' else 'other'

def section_text(soup, label):
    h = None
    for tag in soup.find_all(['h2', 'h3', 'h4']):
        if tag.get_text(' ', strip=True).lower().startswith(label.lower()):
            h = tag; break
    if not h:
        return None
    # Walk forward in document order until the next heading, collecting leaf text.
    # Robust to both layouts seen on GLA: content in the heading's own siblings,
    # or in the heading's parent's following block.
    parts = []
    for el in h.find_all_next():
        if el.name in ('h2', 'h3', 'h4'):
            break
        if el.name in ('p', 'li'):
            t = el.get_text(' ', strip=True)
            if t:
                parts.append(t)
    if not parts:
        nxt = h.parent.find_next_sibling()
        if nxt:
            t = nxt.get_text(' ', strip=True)
            if t:
                parts.append(t)
    seen = set(); out = []
    for p in parts:
        if p not in seen:
            seen.add(p); out.append(p)
    return ' '.join(out).strip() or None

def parse_date(text):
    m = re.search(r'\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b', text or '')
    if not m:
        return None
    return datetime(int(m.group(3)), MONTHS[m.group(2)], int(m.group(1))).date()

def run(session, max_pages, months_back):
    cutoff = (datetime.utcnow() - timedelta(days=30 * months_back)).date()
    seen = set()
    rows = []
    scanned = 0
    for page in range(max_pages):
        try:
            r = requests.get(f"{BASE}{LIST_PATH}?page={page}", headers=HEADERS, timeout=30)
        except Exception:
            break
        if r.status_code != 200:
            break
        soup = BeautifulSoup(r.text, 'html.parser')
        links = []
        for a in soup.find_all('a', href=True):
            h = a['href']
            if LIST_PATH + '/' in h:
                full = h if h.startswith('http') else BASE + h
                if full not in seen:
                    seen.add(full); links.append(full)
        if not links:
            break
        page_dates = []
        for url in links:
            scanned += 1
            try:
                dr = requests.get(url, headers=HEADERS, timeout=30)
            except Exception:
                continue
            if dr.status_code != 200:
                continue
            ds = BeautifulSoup(dr.text, 'html.parser')
            h1 = ds.find('h1')
            title = h1.get_text(' ', strip=True) if h1 else url.rsplit('/', 1)[-1]
            slug = url.rsplit('/', 1)[-1].lower()
            regime = 'EIR' if (slug.startswith('eir') or title.upper().startswith('EIR')) else 'FOI'
            ref_m = re.search(r'MGLA[0-9A-Za-z-]+', dr.text)
            ref = ref_m.group(0) if ref_m else None
            req = section_text(ds, 'Summary of request')
            resp = section_text(ds, 'Our response')
            mlabel = None
            ml = re.search(r'\[([A-Za-z]+\s+20\d{2})\]', title)
            if ml:
                mlabel = ml.group(1)
            # Date: prefer the Key information block, then full visible text, then month label.
            ki = section_text(ds, 'Key information') or ''
            rdate = parse_date(ki) or parse_date(ds.get_text(' ', strip=True))
            if not rdate and mlabel:
                mm = re.match(r'([A-Za-z]+)\s+(20\d{2})', mlabel)
                if mm and mm.group(1) in MONTHS:
                    rdate = datetime(int(mm.group(2)), MONTHS[mm.group(1)], 1).date()
            if rdate:
                page_dates.append(rdate)
                if rdate < cutoff:
                    continue
            theme = classify_theme(regime, f"{title} {req or ''} {resp or ''}")
            rows.append((url, ref, title, regime, theme, (req or '')[:8000], (resp or '')[:12000], rdate, mlabel))
        # newest-first: if the whole page predates the cutoff, stop
        if page_dates and all(d < cutoff for d in page_dates):
            break

    new_n = upd_n = 0
    for (url, ref, title, regime, theme, req, resp, rdate, mlabel) in rows:
        esc = lambda v: ("'" + v.replace("'", "''") + "'") if v is not None else 'NULL'
        dval = f"TO_DATE('{rdate.isoformat()}')" if rdate else 'NULL'
        merged = session.sql(f"""
            MERGE INTO GLA_DISCLOSURE_LOG t
            USING (SELECT {esc(url)} AS SOURCE_URL) s
            ON t.SOURCE_URL = s.SOURCE_URL
            WHEN MATCHED THEN UPDATE SET
                REFERENCE_NUMBER={esc(ref)}, TITLE={esc(title)}, REGIME={esc(regime)}, THEME={esc(theme)},
                REQUEST_SUMMARY={esc(req)}, RESPONSE_TEXT={esc(resp)}, RESPONSE_DATE={dval},
                MONTH_LABEL={esc(mlabel)}, SCRAPED_AT=CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT
                (SOURCE_URL, REFERENCE_NUMBER, TITLE, REGIME, THEME, REQUEST_SUMMARY, RESPONSE_TEXT, RESPONSE_DATE, MONTH_LABEL)
                VALUES ({esc(url)}, {esc(ref)}, {esc(title)}, {esc(regime)}, {esc(theme)}, {esc(req)}, {esc(resp)}, {dval}, {esc(mlabel)})
        """).collect()
        n = merged[0] if merged else None
        if n is not None:
            new_n += (n[0] or 0) + (n[1] or 0) if len(n) > 1 else (n[0] or 0)
    return f"GLA scrape complete: scanned {scanned} entries, {len(rows)} within {months_back}m window, {new_n} rows inserted/updated."
$$;

SELECT 'GLA scraper ready' AS STATUS;
