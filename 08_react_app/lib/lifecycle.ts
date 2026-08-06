/**
 * The FOIA lifecycle, expressed two ways:
 *   - 17 detailed lifecycle stages (STAGE_CODE), and
 *   - the 5-step statutory FOIA process (+ a s.50 Challenge step) they roll up into.
 *
 * This module is PURE DATA with no server dependencies, so it is safe to import
 * from client components. Never import runtime values from lib/queries.ts into a
 * client component — that pulls in snowflake-sdk and breaks the bundle.
 */

export const PHASES: { id: string; label: string; note: string; stages: string[] }[] = [
  { id: "Receipt", label: "1. Receipt & logging", note: "s.8 · s.10", stages: ["RECEIPT", "VALIDITY"] },
  { id: "Triage", label: "2. Triage & allocation", note: "s.16", stages: ["CLASSIFY", "SAR_REDIRECT", "DUPLICATE", "CLARIFICATION", "ALLOCATION"] },
  { id: "Retrieval", label: "3. Retrieval & cost", note: "s.12", stages: ["SEARCH", "COST"] },
  { id: "Assess", label: "4. Review, redaction & PIT", note: "s.40/43 · s.45", stages: ["EXEMPTIONS", "PIT", "REDACTION"] },
  { id: "Signoff", label: "5. Sign-off & disclosure", note: "s.17", stages: ["DRAFTING", "QA", "DISPATCH", "PUBLISH"] },
  { id: "Challenge", label: "Challenge", note: "s.50", stages: ["REVIEW"] },
]

export const STAGE_TO_PHASE: Record<string, string> = Object.fromEntries(
  PHASES.flatMap((p) => p.stages.map((s) => [s, p.id])),
)

// First stage of each phase — the target a card lands on when dragged into it.
export const PHASE_FIRST_STAGE: Record<string, string> = Object.fromEntries(
  PHASES.map((p) => [p.id, p.stages[0]]),
)
