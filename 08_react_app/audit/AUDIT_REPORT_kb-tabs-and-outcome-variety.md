# Audit report: KB v2, tab fixes and response-outcome variety

Plan: `kb-tabs-and-demo-narrative`. Local audit on `http://localhost:3000`, light theme. Gate: PASS.

## Build gate
- `npx tsc --noEmit`: clean, no errors.
- `npm run build`: success, all routes compiled (incl. `/guidance`, `/cases`, `/cases/[reference]`, `/api/suggest-answer/precompute`).

## Changes verified live (light theme)

| # | Change | Result |
|---|--------|--------|
| 1 | KB evidence base regrouped Records / Disclosure logs / Guidance & legislation | PASS - three colour-accented sections (blue / teal / amber), Records renders as a full-width hero, no empty grid cell |
| 1 | Peer sources rolled into one card | PASS - single "Peer disclosure logs" card, 11,529, sub-sources (Camden / WDTK / GLA / Brentwood) listed inside; OGL / mySociety attribution retained |
| 2 | Legislation library deep links | PASS - statutory refs link to legislation.gov.uk (S.40(2) to section/40, S.36P to section/36, EIR-R5 to uksi/2004/3391/regulation/5); non-statutory procedure/CoP codes render as plain text (not links) |
| 3 | Published tab reframed | PASS - tab relabelled "Already published (s.21)"; intros distinguish the research index from the s.21 reply-drafter |
| 4 | `suggestedResponseType` wired into batch dispatch, intake, review lane; OUTCOME written on dispatch | PASS - typecheck clean; dispatch maps type to GRANTED_FULL / GRANTED_PARTIAL / REFUSED / S21_REUSE |
| 5 | s.21 already-published as a quick win | PASS - Quick wins lane now shows 6; FOI-2026-0108 and 0109 carry the "Already published (s.21)" badge; "Send 6 responses" |
| 6 | Typed drafts seeded; empty 0119 fixed | PASS - 0108 seeded S21_REUSE (19 sources); 0119 seeded PARTIAL (20 sources), opens with a ready letter that cites real figures, withholds cardholder data under s.40(2) with a public-interest test; 0115 REFUSAL retained |

## Data seed (demo)
- FOI-2026-0119: added s.40(2)-apply + s.43-disclose exemption assessments and set OUTCOME=GRANTED_PARTIAL so the pipeline derives PARTIAL; grounded PARTIAL draft generated.
- FOI-2026-0108: grounded S21_REUSE draft generated (OUTCOME was already S21_REUSE).

## Held
- SPCS redeploy held for user review (standing rule).
