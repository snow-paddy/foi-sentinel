# 09_examples — data loading scripts

Scripts for populating the knowledge-base tables that are not seeded by the
numbered DDL. Run these after completing steps 1–4 in `docs/DEVELOPER_GUIDE.md`.

## Camden FOI corpus (`CAMDEN_FOI_RESPONSES`)

The Camden corpus is the largest and most valuable knowledge base — 11,420
published FOI responses used for drafting precedent. It is not seeded by the
numbered DDL and must be loaded separately. Three options:

| Script | Approach | When to use |
|--------|----------|-------------|
| `01_camden_soda_api.sql` | Stored procedure that calls the Socrata SODA API directly from Snowflake | Automated; reproducible |
| `02_camden_csv_stage.sql` | Bulk load from a CSV export | Quickest one-time load |
| `03_camden_data_share.sql` | Receive the table via Snowflake Secure Data Sharing | Only if the source account shares it |

### Source
Camden publishes their FOI responses as open data under the Open Government
Licence. The current public dataset ID is `fkj6-gqb4` on `opendata.camden.gov.uk`
(Socrata platform). An older dataset ID (`j7mk-4ya8`) has been made private and
now requires login; use `fkj6-gqb4` instead. No API key or account is required.

API documentation: https://opendata.camden.gov.uk/stories/s/Camden-Open-Data-API/tf35-tpy4/
Public endpoint: `GET https://opendata.camden.gov.uk/resource/fkj6-gqb4.json`

## GLA disclosure log (`GLA_DISCLOSURE_LOG`)

No script needed. The built-in scraper `SP_SCRAPE_GLA_DISCLOSURE_LOG` (in
`04_procedures/03_web_scrapers.sql`) populates this table on demand from the
Settings page, provided the External Access Integration `FOI_WEB_EAI` is
configured.

## WDTK data (`WDTK_AUTHORITY`, `WDTK_EVENT`)

No script needed. `02_seed_data/04_load_wdtk.sql` and the committed seed file
`02_seed_data/wdtk_raw.json` cover this automatically.
