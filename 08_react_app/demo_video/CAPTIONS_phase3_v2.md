# Phase 3 (Act 3) — caption / script plan — HELD ASIDE FOR REVIEW

Cut: `out/phase3_roughcut_v2.mp4` — 2m18s, silent, 1710w. NOT burned yet.
Timings are against the v2 cut. Two beats deviate from the original script (flagged **[DEVIATION]**).

| v2 time | On screen | Proposed caption |
|---|---|---|
| 0:00 | SAR queue landing (overview + queue) | A Subject Access Request. Requests stay pseudonymised until identity is verified. |
| 0:13 | Identity verified tooltip hover **[DEVIATION — unscripted hover]** | How do we know it is really them? Identity was verified out of band, against the council's own Housing Benefit claim record, before any data was revealed. |
| 0:23 | Section 1 findings, "clears 2 of 6" | One Cortex Search query spans five source systems. AI_CLASSIFY clears two of six as the subject's own and flags the rest for third-party review. |
| 0:31 | Housing Meeting Note opens in SharePoint | Every finding links to the real source. This one opens the live document in SharePoint. |
| 0:48 | Section 2 structured masking + disclosure bundle | Structured records are masked in the data layer, enforced by Snowflake rather than the app. The disclosure bundle is the subject's own records only. |
| 1:13 | Section 3 Redaction Studio (source doc, Redacting) | For the document itself, AI_PARSE_DOCUMENT and AI_EXTRACT detect third-party PII. |
| 1:37 | 9 of 9 redacted + AI SQL panel | Nine items flagged with confidence scores, three of James's own kept. The AI suggests, the officer decides. |
| 1:58 | SharePoint "Uploaded" tick, ASC doc lands | Now a caseworker drops a new case file into SharePoint. |
| 2:03 | ASC document open (Sarah Quinn / s.40) | The file names a third party, so it must be handled before disclosure. |
| 2:11 | Platform findings "2 of 7" **[DEVIATION — now a live demonstration, not narrated]** | Openflow syncs it, Cortex Search indexes it, and it appears in the findings automatically, already flagged. All within one governed Snowflake platform. |

Deviations from the original script:
1. **Identity-verified hover (0:13)** was unscripted. It is a strong beat — worth a dedicated caption on the out-of-band verification against the HB claim record.
2. **Pipeline payoff (2:11)** is now a live demonstration (upload tick -> open doc -> appears as 2 of 7) rather than a narrated claim. Stronger; caption should describe what just happened, not promise it.

VO comes last, after captions are locked.
