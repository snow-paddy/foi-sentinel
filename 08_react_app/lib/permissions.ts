/**
 * Role-based permission rules for the simulated user-switcher — PURE and
 * client-safe (no server imports), so UI components can call `can()` to enable
 * or disable controls. The server-side gate lives in lib/permissions-server.ts.
 *
 * Because the app runs owner's rights, gating is application-level, not
 * database isolation: it governs what actions a chosen persona may perform, not
 * what data they can read. Gating only bites once an officer is selected; with
 * no selection everything is permitted (pre-feature behaviour).
 */

export type Action =
  | "CLOCK"
  | "DECIDE_EXEMPTION"
  | "VERIFY_REDACTION"
  | "FINALISE_RESPONSE"
  | "DISPATCH"
  | "ADVANCE_STAGE"
  | "MARK_PRECEDENT"
  | "PUBLISH"
  | "SIGN_OFF"
  | "ASSIGN"

/** Canonical personas, verbatim from FOI_OFFICER.PERSONA. */
export const PERSONA = {
  OFFICER: "FOI / Information Governance Officer",
  SAR: "Data Protection / SAR Officer",
  SPOC: "Service contact (SPOC)",
  REVIEWER: "Senior / Independent Reviewer",
  MANAGER: "Information Governance Manager",
} as const

const ALL: Action[] = [
  "CLOCK", "DECIDE_EXEMPTION", "VERIFY_REDACTION", "FINALISE_RESPONSE", "DISPATCH",
  "ADVANCE_STAGE", "MARK_PRECEDENT", "PUBLISH", "SIGN_OFF", "ASSIGN",
]

/** persona → the actions it may perform. Mirrors the matrix in the plan card. */
const MATRIX: Record<string, Action[]> = {
  [PERSONA.OFFICER]: ["CLOCK", "DECIDE_EXEMPTION", "VERIFY_REDACTION", "FINALISE_RESPONSE", "ADVANCE_STAGE", "MARK_PRECEDENT", "ASSIGN"],
  [PERSONA.SAR]: ["CLOCK", "DECIDE_EXEMPTION", "VERIFY_REDACTION", "FINALISE_RESPONSE", "ADVANCE_STAGE", "MARK_PRECEDENT", "ASSIGN"],
  [PERSONA.SPOC]: ["ASSIGN"],
  [PERSONA.REVIEWER]: ["DECIDE_EXEMPTION", "VERIFY_REDACTION", "FINALISE_RESPONSE", "ADVANCE_STAGE", "MARK_PRECEDENT", "SIGN_OFF", "ASSIGN"],
  [PERSONA.MANAGER]: ALL,
}

/** Human-readable action labels for tooltips / errors. */
export const ACTION_LABEL: Record<Action, string> = {
  CLOCK: "pause or resume the statutory clock",
  DECIDE_EXEMPTION: "decide an exemption",
  VERIFY_REDACTION: "verify a redaction",
  FINALISE_RESPONSE: "finalise the response",
  DISPATCH: "dispatch the response",
  ADVANCE_STAGE: "advance the case stage",
  MARK_PRECEDENT: "mark a precedent",
  PUBLISH: "publish to the disclosure log",
  SIGN_OFF: "sign off the response",
  ASSIGN: "assign or claim a case",
}

/** Pure check — safe to use in UI to enable/disable controls. */
export function can(persona: string | null | undefined, action: Action): boolean {
  if (!persona) return true // no simulated identity selected → permissive
  const allowed = MATRIX[persona]
  if (!allowed) return true // unknown persona → don't block (defensive)
  return allowed.includes(action)
}

/** The full allowed-action set for a persona (for shipping to the client once). */
export function allowedActions(persona: string | null | undefined): Action[] {
  if (!persona) return ALL
  return MATRIX[persona] ?? ALL
}

export class PermissionError extends Error {
  readonly code = "FORBIDDEN"
  constructor(message: string) {
    super(message)
    this.name = "PermissionError"
  }
}
