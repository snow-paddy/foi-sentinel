# Audit — SAR script cross-check + council-lens copy sweep (2026-07-07)

**Mode:** re-audit after changes. Reused `personas.md` + `user_stories.md`. Presenter click-through of the individual SAR case (SAR-2026-0107, James Whitfield), every script beat verified against the running app on `localhost:3000`, all on-screen text scrutinised for a UK council audience and AI-tells.

## Script beats vs app (all verified)

| Beat | Script claim | On screen | Result |
|------|--------------|-----------|--------|
| 0 | Queue pseudonymised; open the verified request | 3 rows, all "Anonymous Resident" / "Withheld pending ID"; only 0107 openable | PASS |
| 1 | Header resolves to named subject + live clock | "Identity verified" (now hoverable — reveals verification provenance), received as Anonymous Resident, James Whitfield, claim HB-2026-55821, Due 2026-07-22 running one calendar month | PASS |
| 2 | One Cortex Search across 5 systems + AI_CLASSIFY triage | 6 records across Housing/Complaints/Benefits/Adult Social Care/Information Governance; AI clears 2 (Benefits Email Thread, IG SAR Received) as "subject only" and flags 4 as "third-party: review" | PASS |
| 3 | Masking policy in data layer + disclosure bundle | Subject rows in clear; Margaret Whitfield / R Shah / Sarah Quinn fully masked; V_SAR_DISCLOSURE = subject-only | PASS |
| 4 | Redaction Studio: AI_PARSE_DOCUMENT + AI_EXTRACT, human sign-off | Source doc renders with synthetic banner + "Run AI redaction"; pre-warm returned ok:true (cached) | PASS |
| 5 | Four "why Snowflake" tiles + live/synthetic note | All present; note now reads cleanly | PASS |

## Defects found and fixed this pass

1. **Glued words on camera** — closing note rendered "connectorinto" (JSX whitespace edge case, same class as the earlier fix). Fixed with explicit `{" "}`; re-verified reads "connector into" and "the Openflow".
2. **IT jargon, not council language** — "LOB records" / "structured LOB data" in Section 2 prose, Section 4 tile and the closing note. Replaced with "case-management records" / "structured case records". No "LOB" remains.
3. **Source-label inconsistency** — Section 2/disclosure rendered the raw enum "SocialCare" (glued) while Section 1 showed "Adult Social Care". Added a `SOURCE_LABEL` map so the badge displays "Social Care". Re-verified across all three tables.

## Follow-up changes (post-audit, 2026-07-07)

1. **Hoverable "Identity verified" badge** — the badge in the case header now reveals a CSS-only popover (header stays a server component) explaining how identity was confirmed: logged pseudonymised as "Anonymous Resident", then verified out of band on 2026-06-24 by K. Ellison (Information Governance) via photo ID + proof of address, matched to Housing Benefit claim HB-2026-55821, under UK GDPR Art 12(6). Backed by four new `SAR_CASE_SUBJECT` columns (VERIFIED_ON/BY, VERIFICATION_METHOD/BASIS), surfaced through `SarSubject`/`getSarData`. Resolves the "received as Anonymous Resident yet verified" question — the pseudonym is the queue display, verification is a separate evidence step.
2. **Section 1 triage mix (data-honest)** — flags reclassified from document content, not fabricated: 4 docs name a private third party (witness, landlord R Shah + neighbour, caseworker Sarah Quinn, subject's brother) matching the three individuals masked in the structured view; 2 contain only the subject's data (IG SAR Received; Benefits Email Thread, where the only other name is an officer acting officially). Corpus flags updated live. Caption now states the live result: "clears 2 of 6 ... flags the rest for a third-party review".

## Functional-gate verification

Confirmed the identity gate works in practice, not just cosmetically: `getSarData` returns empty findings/working/disclosure and skips Cortex when a case is unverified. Loaded SAR-2026-0151 (unverified) — no subject name, no claim reference, no "Identity verified" badge; shows "cannot be opened until the requester's identity is verified. The statutory clock is paused until then." Only SAR-2026-0107 resolves to a named subject. Flipping `IDENTITY_VERIFIED` genuinely locks a case down.

## Council-lens copy notes (advisory, not blocking)

- Legal-framing cards rewritten concise, key facts bolded: one calendar month / extendable to three, Article 15, serious-harm. Both FOI-comparison phrases removed per instruction.
- "Revenues", "Adult Social Care", "OFFICIAL — SENSITIVE" all read as authentic council vocabulary.
- Section 1 mix now demonstrates the AI's discrimination visibly (4 review / 2 subject-only) — the earlier all-six-flagged note is resolved.

## Gate decision: PASS (deployable)

All key-use-case stories PASS; visual/theme sweep clean on the SAR pages after the three fixes and the two follow-up changes; identity gate verified functional. DB changes (verification columns, corpus flags) are live; the app-code changes are NOT yet on SPCS — cleared for the batched deploy held for last.
