# Demo-Validity Audit — Quick-wins Provenance Flow (WI-12)

Scope: the `/cases` "Quick wins" lane + the grounded draft + Data provenance strip, audited as it will be
demoed. Lens: every on-screen subtitle claim and every "how it's hooked up" technical explanation must be
verifiable against the running app, the data and the code. Harness: http://localhost:3100 (Next dev).

## Verified demo-script fragment (this flow)

Legend: [VERIFIED] holds on camera · [GAP] true-but-unshown · [FIX] would mislead / break if exercised.

### Subtitle lines (user-facing)
1. "These are low-complexity requests with a strong precedent match — the AI has pre-drafted each reply."
   → [VERIFIED] precedentPct = FOI_PRECEDENT_MATCH.SIMILARITY_PCT, computed by real AI_SIMILARITY over request text
   (01_ddl/06_precedent_match.sql SP_REFRESH_PRECEDENT_MATCH). Caveat: the precedent corpus includes curated
   SYNTHETIC precedents (FOI_SYNTH_PRECEDENT, flagged IS_SYNTHETIC) — the % is honest, the matched item may be synthetic.
2. "Every figure comes from the council's own verified systems of record, and is cited."
   → [VERIFIED] grounding: letter cites real figures (0126 = "214 appeals, 63 upheld (29%) [S1]") grounded in
   EDUCATION_ADMISSION_APPEALS. [GAP] "cited": inline [S1]/[S2] markers appear but NO on-screen legend resolves
   them (neither the quick-win card nor the case detail shows what [S1] is).
3. "The provenance strip shows which systems of record each figure came from — verified vs peer."
   → [VERIFIED] on the quick-win card (DATA_SOURCE_REGISTRY-driven chips + peer count). [GAP] the strip is NOT
   shown on the case-detail Response Studio, where the same grounded letter is edited.
4. "Nothing is sent until the officer confirms — and what you see is exactly what's sent."
   → [VERIFIED] confirm gate + batchDispatch promotes DRAFT_TEXT->FINAL_TEXT verbatim then dispatches; no regeneration.

### Technical explanation (how it's hooked up) — verified
- generateGroundedLetter() reuses gatherGroundedSources() (7 Cortex Search corpora incl. INTERNAL_HOLDINGS,
  OWN_REPLY, DISCLOSURE_LOG, WDTK/GLA/Camden/Brentwood, policy), builds a full letter grounded in real figures,
  stores the source trail on FOI_RESPONSE.SOURCES. [VERIFIED]
- Figures = COUNCIL_INTERNAL_HOLDINGS_FACTS attributed to realistically-named LA tables (SOURCE_TABLE/SOURCE_SYSTEM);
  verified vs peer from DATA_SOURCE_REGISTRY (32 verified internal / 5 external peer). [VERIFIED]
- Quality: 81% groundedness, 85% coverage, 27 PASS / 9 WEAK / 0 FAIL, provenance on 36/36. [VERIFIED]

## Findings (gate)

- **F1 [HIGH · gate-blocking] Generate action is still ungrounded.** The case-detail "Generate compliant draft"
  button (ResponseStudio -> /api/response/generate -> generateResponse -> SP_GENERATE_RESPONSE) and batchDispatch's
  no-draft fallback both use the UNGROUNDED SP_GENERATE_RESPONSE. If clicked on a quick-win case during the demo it
  OVERWRITES the grounded, cited letter with a fabricated ungrounded one. Contradicts "unify both systems".
  Fix: point the generate action at generateGroundedLetter (grounded path).
- **F2 [MEDIUM] No citation legend.** Inline [S1]/[S2] markers are visible but unresolved on both the card and the
  case detail. The "cited" claim is weak without a visible [S1]=source legend. Fix: render an S-tag -> source list
  (draft.sources already carries tag/origin/title/sourceTable) on the card and/or case detail.
- **F3 [LOW-MED] Provenance strip not on case detail.** The grounded letter is editable in the Response Studio with
  no provenance strip; only the quick-win card shows it. Surface the strip on the case detail too for consistency.
- **F4 [NOTE] Precedent corpus partly synthetic.** Demo-script technical note must say the precedent library includes
  curated synthetic examples (already flagged IS_SYNTHETIC) — do not imply it is all real historical precedent.

## Visual/theme
- Quick-win card + provenance strip render cleanly on the light canvas (green verified chips on ok-bg, muted peer
  chip, readable). Screenshot captured. No dark-surface/contrast defects observed in this flow.

## Gate decision: PASS (re-audited after fixes)

Initial audit was BLOCKED on F1. All findings now fixed + live-verified:
- **F1 FIXED**: generateResponse() (case-detail "Generate compliant draft") and batchDispatch's no-draft fallback
  now call generateGroundedLetter() — the grounded path. Verified: /api/response/generate on 0126 -> 18 sources,
  [S1] citation, real figure 214, S1 table EDUCATION_ADMISSION_APPEALS. No ungrounded regeneration possible.
- **F2 FIXED**: new shared CitationLegend resolves the [Sn] markers actually present in the text -> source
  (origin + title + table + verified tick). Rendered on the quick-win card AND the case-detail studio. Verified:
  "[S1] This council's records — Appeals heard (EDUCATION_ADMISSION_APPEALS)".
- **F3 FIXED**: shared ProvenanceStrip extracted to components/shared/provenance.tsx and rendered on the case-detail
  Response Studio too. Verified chips incl. EDUCATION_ADMISSION_APPEALS, FOI_RESPONSE, DISCLOSURE_LOG.
- **F4**: demo-script technical note kept honest re. synthetic precedent examples (no code change).

tsc clean throughout. Visual: strip + legend render cleanly on the light canvas. Flow is demo-valid.

