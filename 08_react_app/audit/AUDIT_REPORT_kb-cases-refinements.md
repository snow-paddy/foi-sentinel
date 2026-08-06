# Audit report — KB & Cases refinements

**Scope:** the `kb-and-cases-refinements` plan (Knowledge Base categorisation + search-on-top, WDTK provenance copy, shared Board filters, Reviews & ICO narrative, Kanban Challenge semantics).
**Harness:** local `next dev` on `http://localhost:3000` (hot-reloaded source). Driven with the agentic browser.
**Theme:** production pins light; harness rendered light throughout. No dark-surface-on-light-canvas defects seen on the audited pages.
**Personas/stories reused from:** `audit/personas.md`, `audit/user_stories.md` (re-audit path).

## Story results

| Story | Surface | Signal asserted | Result |
|---|---|---|---|
| US-EU-05 [Knowledge/precedent] | `/guidance` | Evidence-base grid with corpus counts renders | PASS — now grouped into 4 categories, counts intact |
| US-EB-03 [KEY — data honesty] | `/guidance` | Sources attributed + synthetic labelled | PASS — WDTK now "re-used under the Open Government Licence" (not "scraped"); mySociety/OGL/PSI-2015 attribution footer added; SYNTHETIC label retained |

## Change-by-change verification

1. **KB categorisation** — PASS. Four labelled groups render: "Exampleton Council's logs & records" (own records 97 + own log 5), "Peer disclosure logs" (WDTK 54, WDTK real 1, Camden 11,420, GLA 38, Brentwood 16), "FOIA / EIR legislation" (59), "Council & ICO guidance" (42). Council name resolved dynamically. The previously-duplicative "own records / own log" pair now sits under one category — bloat resolved.
2. **Search above boxes** — PASS. The Guidance & precedent search panel (tabs + input + chips) renders above the "Evidence base" card.
3. **WDTK provenance copy** — PASS. Card access text corrected; peer-group attribution footer present (OGL / Re-use of PSI Regs 2015, mySociety attribution, snippets-not-bulk, link-back). Aligns UI with `docs/DATA_SOURCES.md` + DDL header.
4. **Shared Board filters** — PASS. Chip row (All open/At risk/Overdue/FOI/EIR/SAR) now renders on Board and preserves `&view=board`. Verified server-side filter: `/cases?regime=FOI&view=board` → 31 FOI cards, 0 EIR/SAR. (Note: agentic client-nav snapshot can lag; direct-URL check confirms.)
5. **Reviews & ICO narrative** — PASS. Statutory-redress narrative added; stat strip (internal reviews open, ICO complaints open, published to log s.19, sector overturn %); queues carry real data; explanatory empty states added for when they don't.
6. **Kanban Challenge semantics** — PASS. Challenge column is visually distinct (dashed amber border, amber header underline, "Requester-led · not draggable" sublabel) and non-drop (`isDropDisabled` + `isDragDisabled` on cards + `onDragEnd` guard rejecting Challenge as source/target). Board-overview copy updated to describe Challenge as requester-led, visibility-only. Moving a card advances stage only — priority unchanged (stored triage field), matching the answer given.

## Build gate
- `npx tsc --noEmit` — clean.
- `npm run build` — "Compiled successfully"; `/guidance` and `/cases` present in route manifest.

## Gate decision
**PASS.** Both key/`/guidance` stories pass; all six plan changes verified on the running harness in light theme; no visual/theme defects on the audited surfaces. Cleared for the operator's own review, then SPCS redeploy.

## Not automated (rely on code guard)
- Drag-rejection into/out of Challenge: `@hello-pangea/dnd` synthetic drag is unreliable via the agentic browser. Enforced by `isDropDisabled`/`isDragDisabled` + `onDragEnd` guard (unambiguous in source).
