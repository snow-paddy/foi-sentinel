# Live SharePoint pull-through — upload & verify

The asset: **`2026-04-02_ASC-2026-04021_file_note.docx`** (in this folder). It is a realistic Adult
Social Care / Housing Options file note about the SAR subject **Mr James Whitfield**, so once
ingested it appears in `/sar`. It names a third party (his neighbour **Mrs Sarah Quinn**, with a
contact number), so Cortex `AI_CLASSIFY` flags it as containing third-party data.

Baseline before upload (2026-07-05): **6 files, 12 chunks, 6 distinct docs** in `FOI.SAR_INGEST`.

## Step 1 — Upload to SharePoint (the only manual step, done on camera)
1. Browser → `https://exampleton.sharepoint.com/sites/FOISARDemo`
2. Left nav → **Documents** (the library the connector watches).
3. **Upload → Files** → choose
   `08_react_app/audit/demo-assets/2026-04-02_ASC-2026-04021_file_note.docx`.
4. Wait for the file to show in the library with today's date.

> On camera this is the "watch this" moment: a caseworker just saved a file — nothing else.

## Step 2 — Let Openflow ingest it (CDC)
The no-ACL SharePoint connector polls on its schedule, then parses + chunks the file.
Allow one poll interval before checking (typically a minute or two). If you want to nudge it,
the connector's *Capture Sharepoint Changes* processor can be triggered from the Openflow
canvas, but waiting is fine for the demo.

## Step 3 — Verify it landed (Snowflake)
```sql
-- Counts should tick up: 6 -> 7 files, 12 -> 14+ chunks.
SELECT
  (SELECT COUNT(*) FROM FOI.SAR_INGEST.FILE_HASHES) AS FILES,
  (SELECT COUNT(*) FROM FOI.SAR_INGEST.DOCS_CHUNKS) AS CHUNKS,
  (SELECT COUNT(DISTINCT metadata:fullName::string) FROM FOI.SAR_INGEST.DOCS_CHUNKS) AS DISTINCT_DOCS;

-- The new document should be present by file name:
SELECT DISTINCT metadata:fullName::string AS full_name
FROM FOI.SAR_INGEST.DOCS_CHUNKS
WHERE metadata:fullName::string ILIKE '%file_note%';

-- Cortex Search should rank it for the SAR query (indexing lag ~ the service TARGET_LAG):
SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
  'FOI.SAR_INGEST.SAR_SHAREPOINT_SEARCH',
  '{"query":"James Whitfield temporary accommodation social care complaint","columns":["full_name"],"limit":10}'
);
```

## Step 4 — (optional) Enrich the corpus table
`/sar` LEFT JOINs `SAR_SHAREPOINT_DOC_CORPUS` for source-system + third-party flag. A brand-new
doc shows in `/sar` from the search alone (flag NULL). To give it a source label + flag, re-run the
corpus build (as `OPENFLOW_RUNTIME_ROLE_SAR`, per the ingest memory) so it picks up the 7th doc.

## Step 5 — Show it in the app
Open `http://localhost:3000/sar`. The findings list (previously 6 docs) now includes
the **ASC file note (ASC-2026-04021)** with its date and a link back to the SharePoint URL — proving the
document a caseworker saved minutes ago is discoverable in the SAR workflow, with no re-upload.

## Recording note
Steps 1-2 (SharePoint + Openflow) are on an external authenticated site + CDC latency — capture
them as a **manual screen recording** (headed browser, log in by hand), then stitch with the
automated `/sar` walkthrough. See `demo-script.md` (section 6).
