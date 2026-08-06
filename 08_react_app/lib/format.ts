/**
 * Pure presentation helpers — safe to import from both server and client
 * components (no Snowflake/server-only imports here).
 */

export type SentimentBand = {
  label: "Negative" | "Neutral" | "Positive"
  glyph: string
  color: string
}

/**
 * Map a Cortex sentiment score (-1..1) to a human band. Used on the board
 * cards, the cases list and the case detail page so the three agree.
 */
export function sentimentBand(score: number): SentimentBand {
  if (score < -0.3) return { label: "Negative", glyph: "▼", color: "var(--danger)" }
  if (score > 0.3) return { label: "Positive", glyph: "▲", color: "var(--ok)" }
  return { label: "Neutral", glyph: "●", color: "var(--muted-foreground)" }
}

/**
 * Demo-origin detection. Cases created via the Email Intake demo carry a "-D"
 * reference token (e.g. FOI-2026-D06291423), distinct from seeded "-0NNN" refs.
 * SOURCE='EMAIL' is NOT a reliable signal (many seeded cases use it too).
 */
export function isDemoCase(reference: string): boolean {
  return /-\d{4}-D\d{6,}$/.test(reference)
}

export type PriorityStyle = { bg: string; fg: string; dot: string; label: string }

/**
 * Map a PRIORITY_BAND (HIGH/MEDIUM/LOW) to a filled chip style on the GOV.UK
 * palette. Shared by the Focus cards, the cases list and the board so the
 * three agree. High = red, Medium = amber, Low = slate.
 */
export function priorityStyle(band: string | null | undefined): PriorityStyle {
  switch ((band ?? "").trim().toUpperCase()) {
    case "HIGH":
      return { bg: "var(--danger-bg)", fg: "var(--danger)", dot: "var(--danger)", label: "High" }
    case "MEDIUM":
    case "MED":
      return { bg: "var(--warn-bg)", fg: "var(--warn-text)", dot: "var(--warn)", label: "Medium" }
    case "LOW":
      return { bg: "var(--muted)", fg: "var(--muted-foreground)", dot: "var(--muted-foreground)", label: "Low" }
    default:
      return { bg: "var(--muted)", fg: "var(--muted-foreground)", dot: "var(--muted-foreground)", label: band || "—" }
  }
}

/**
 * Resolve a statutory reference (e.g. "S.40", "s.12", "EIR reg.5") to its
 * legislation.gov.uk URL. Shared by the Knowledge Base and the decision summary
 * so both deep-link the same way. Returns null for references we do not map.
 */
export function legislationUrl(ref: string): string | null {
  const s = (ref ?? "").trim().toUpperCase()
  const foia = s.match(/^S\.?\s*(\d+)/)
  if (foia) return `https://www.legislation.gov.uk/ukpga/2000/36/section/${foia[1]}`
  if (s.startsWith("EIR")) return "https://www.legislation.gov.uk/uksi/2004/3391/regulation/5"
  return null
}

export interface DecisionWithholding {
  section: string
  sectionUrl: string | null
  reason: string
}

/**
 * A plain-English, case-specific explanation of WHY a response has its outcome,
 * rendered outside the draft letter. Derived deterministically from the officer's
 * own exemption assessments and triage, so it is grounded and reproducible.
 */
export interface DecisionRationale {
  type: string
  tone: "ok" | "warn" | "danger"
  headline: string
  summary: string
  releasing: string[]
  withholding: DecisionWithholding[]
  s21Ref?: string
  /** The opening of the letter paragraph where this outcome appears, for the officer's eye. */
  letterPointer?: string
}

/** Quote the opening of the first draft paragraph that states the outcome, as a soft pointer. */
function findLetterPointer(type: string, draftText: string, sectionRefs: string[]): string | undefined {
  let paras = draftText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (paras.length <= 1) paras = draftText.split(/\n/).map((p) => p.trim()).filter(Boolean)
  const nums = sectionRefs.map((s) => (s.match(/(\d+)/)?.[1] ?? "")).filter(Boolean)
  const patterns: RegExp[] = nums.map((n) => new RegExp(`s\\.?\\s*${n}\\b|section\\s*${n}\\b`, "i"))
  if (type === "S21_REUSE" || type === "MIXED_S21") patterns.push(/already published|section\s*21|publicly available|reasonably accessible/i)
  if (!patterns.length) return undefined
  const hit = paras.find((p) => patterns.some((rx) => rx.test(p)))
  if (!hit) return undefined
  const words = hit.split(/\s+/)
  return words.slice(0, 14).join(" ") + (words.length > 14 ? "\u2026" : "")
}

/**
 * Build the decision rationale from the outcome type, the case's exemption
 * assessments (disclose -> what we release, apply -> what we withhold), the
 * s.21 match and the live draft text. Pure and client-safe (structural inputs,
 * no server imports). Returns null for an unrecognised type.
 */
export function buildDecisionRationale(input: {
  type: string
  exemptions: { sectionRef: string; pitFor: string; pitAgainst: string; decision: string }[]
  s21MatchRef?: string
  draftText?: string
}): DecisionRationale | null {
  const type = (input.type || "").toUpperCase()
  const applied = input.exemptions.filter((e) => e.decision.toLowerCase() === "apply")
  const disclosed = input.exemptions.filter((e) => e.decision.toLowerCase() === "disclose")
  const releasing = disclosed.map((e) => e.pitFor.trim()).filter(Boolean)
  const withholding: DecisionWithholding[] = applied
    .map((e) => ({ section: e.sectionRef, sectionUrl: legislationUrl(e.sectionRef), reason: e.pitAgainst.trim() }))
    .filter((w) => w.section || w.reason)
  const sections = [...new Set(applied.map((e) => e.sectionRef).filter(Boolean))].join(", ")

  let tone: DecisionRationale["tone"] = "ok"
  let headline = ""
  let summary = ""
  if (type === "PARTIAL") {
    tone = "warn"
    headline = "Why this is a partial disclosure"
    summary = sections
      ? `We release what we can and withhold the rest under ${sections}.`
      : "We release part of the information and withhold the rest under an exemption."
  } else if (type === "REFUSAL") {
    tone = "danger"
    headline = "Why this is being refused"
    summary = sections
      ? `The information is withheld under ${sections}.`
      : "The information is withheld under an exemption, or it is not held."
  } else if (type === "MIXED_S21") {
    tone = "warn"
    headline = "Why this request is answered in parts"
    summary = sections
      ? `Part of the request is already published, so we signpost it under section 21; we answer the rest and withhold what falls under ${sections}.`
      : "Part of the request is already published, so we signpost it under section 21, and we answer the remainder directly."
  } else if (type === "S21_REUSE") {
    tone = "ok"
    headline = "Why we point to published material"
    summary = "The information is already in the public domain, so under section 21 we direct the requester to it rather than supplying it again."
  } else if (type === "DISCLOSURE") {
    tone = "ok"
    headline = "Why this is released in full"
    summary = "No exemptions are engaged, so the information is disclosed in full."
  } else {
    return null
  }

  const rationale: DecisionRationale = { type, tone, headline, summary, releasing, withholding }
  if (input.s21MatchRef) rationale.s21Ref = input.s21MatchRef
  const pointer = input.draftText ? findLetterPointer(type, input.draftText, applied.map((a) => a.sectionRef)) : undefined
  if (pointer) rationale.letterPointer = pointer
  return rationale
}
