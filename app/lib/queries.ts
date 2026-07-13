import { querySnowflake, querySnowflakeLongRunning } from "@/lib/snowflake"
import { SCHEMA, SAR_INGEST_SCHEMA } from "@/lib/constants"

/**
 * Command Centre data layer. Every function runs real SQL against the live
 * FOI data model under owner's rights. Names of individual requesters are
 * never returned — they are hashed inside Snowflake so personal data does
 * not leave the database (see getRequesterPatterns).
 */

const n = (v: unknown): number => (v == null ? 0 : Number(v))

// Exclude synthetic demo cases so analytics reflect the real corpus.
const REAL_CORPUS = `FROM ${SCHEMA}.FOI_CASE WHERE NOT COALESCE(IS_SYNTHETIC, FALSE)`

export interface Headline {
  open: number
  atRisk: number
  overdue: number
  closed: number
  inTime: number
  pct: number
  foi: number
  eir: number
  sar: number
}

export async function getHeadline(): Promise<Headline> {
  const rows = await querySnowflake(`
    SELECT
      SUM(IFF(STATUS='OPEN',1,0)) OPEN_C,
      SUM(IFF(STATUS='OPEN' AND RAG='RED',1,0)) AT_RISK,
      SUM(IFF(STATUS='OPEN' AND WD_REMAINING<0,1,0)) OVERDUE,
      SUM(IFF(STATUS='CLOSED',1,0)) CLOSED_C,
      SUM(IFF(STATUS='CLOSED' AND ANSWERED_IN_TIME,1,0)) IN_TIME,
      SUM(IFF(REGIME='FOI' AND STATUS='OPEN',1,0)) FOI_O,
      SUM(IFF(REGIME='EIR' AND STATUS='OPEN',1,0)) EIR_O,
      SUM(IFF(REGIME='SAR' AND STATUS='OPEN',1,0)) SAR_O
    FROM ${SCHEMA}.V_CASE
  `)
  const r = rows[0] ?? {}
  const closed = n(r.CLOSED_C)
  const inTime = n(r.IN_TIME)
  return {
    open: n(r.OPEN_C),
    atRisk: n(r.AT_RISK),
    overdue: n(r.OVERDUE),
    closed,
    inTime,
    pct: Math.round((100 * inTime) / (closed || 1)),
    foi: n(r.FOI_O),
    eir: n(r.EIR_O),
    sar: n(r.SAR_O),
  }
}

export async function getSlaTarget(): Promise<number> {
  try {
    const rows = await querySnowflake(`
      SELECT CONFIG_VALUE FROM ${SCHEMA}.COUNCIL_CONFIG WHERE CONFIG_KEY='SLA_TARGET_PCT'
    `)
    const v = Number(rows[0]?.CONFIG_VALUE)
    return Number.isFinite(v) && v > 0 ? v : 90
  } catch {
    return 90
  }
}

export async function getCouncilName(): Promise<string> {
  try {
    const rows = await querySnowflake(`
      SELECT CONFIG_VALUE FROM ${SCHEMA}.COUNCIL_CONFIG WHERE CONFIG_KEY='COUNCIL_NAME'
    `)
    return (rows[0]?.CONFIG_VALUE as string) || "the council"
  } catch {
    return "the council"
  }
}

export interface PipelineStage {
  order: number
  code: string
  stage: string
  onTrack: number
  atRisk: number
  total: number
}

export async function getPipeline(): Promise<PipelineStage[]> {
  const rows = await querySnowflake(`
    SELECT STAGE_ORDER, CURRENT_STAGE AS STAGE_CODE, STAGE_NAME,
           SUM(IFF(COALESCE(RAG,'')='RED' OR COALESCE(WD_REMAINING,999)<0,1,0)) AT_RISK,
           SUM(IFF(NOT(COALESCE(RAG,'')='RED' OR COALESCE(WD_REMAINING,999)<0),1,0)) ON_TRACK
    FROM ${SCHEMA}.V_CASE WHERE STATUS='OPEN'
    GROUP BY STAGE_ORDER, CURRENT_STAGE, STAGE_NAME ORDER BY STAGE_ORDER
  `)
  return rows.map((r) => {
    const onTrack = n(r.ON_TRACK)
    const atRisk = n(r.AT_RISK)
    return {
      order: n(r.STAGE_ORDER),
      code: String(r.STAGE_CODE ?? ""),
      stage: String(r.STAGE_NAME),
      onTrack,
      atRisk,
      total: onTrack + atRisk,
    }
  })
}

export interface PeerBenchmark {
  authority: string
  successRate: number
  peerMedian: number
  rank: number
  peerCount: number
  position: "above" | "below"
}

export async function getPeerBenchmark(councilName: string): Promise<PeerBenchmark | null> {
  try {
    // This council is a demonstration authority and is not part of the
    // WhatDoTheyKnow corpus, so we cannot look it up by name. Instead we compute
    // its own disclosure-success rate live from its decided cases (information
    // released in full or part, or pointed to under s.21, over all cases with a
    // recorded outcome) using the same "information disclosed" semantics as the
    // WDTK SUCCESS_RATE, then rank it among the 16 real authorities.
    const rows = await querySnowflake(`
      WITH own AS (
        SELECT COUNT_IF(OUTCOME IN ('GRANTED_FULL','GRANTED_PARTIAL','S21_REUSE'))
                 / NULLIF(COUNT_IF(OUTCOME IS NOT NULL AND OUTCOME <> ''), 0) AS RATE
        FROM ${SCHEMA}.V_CASE
      ),
      peers AS (SELECT SUCCESS_RATE FROM ${SCHEMA}.V_WDTK_BENCHMARK)
      SELECT
        (SELECT RATE FROM own)                                                       AS OWN_RATE,
        (SELECT MEDIAN(SUCCESS_RATE) FROM peers)                                      AS PEER_MEDIAN,
        (SELECT COUNT(*) FROM peers) + 1                                              AS PEER_COUNT,
        (SELECT COUNT(*) FROM peers WHERE SUCCESS_RATE > (SELECT RATE FROM own)) + 1  AS SUCCESS_RANK
    `)
    if (!rows.length || rows[0].OWN_RATE == null) return null
    const r = rows[0]
    const sr = Number(r.OWN_RATE)
    const med = Number(r.PEER_MEDIAN)
    return {
      authority: councilName,
      successRate: sr,
      peerMedian: med,
      rank: n(r.SUCCESS_RANK),
      peerCount: n(r.PEER_COUNT),
      position: sr >= med ? "above" : "below",
    }
  } catch {
    return null
  }
}

export interface Requester {
  label: string
  type: "Organisation" | "Individual"
  requests: number
  flagged: number
  sentiment: number | null
}

/**
 * Repeat-requester / potential-campaign signal for the Section 14 (vexatious)
 * lens. Personal names are hashed inside Snowflake (SHA2) into stable, opaque
 * "Citizen XXXX" surrogates, so a repeat requester is still grouped together
 * but never identified. Organisations are not personal data and are shown by
 * name. Raw names never leave the database.
 */
export async function getRequesterPatterns(limit = 10): Promise<Requester[]> {
  const rows = await querySnowflake(`
    SELECT
      CASE WHEN REQUESTER_ORGANISATION IS NOT NULL THEN 'Organisation' ELSE 'Individual' END REQ_TYPE,
      CASE WHEN REQUESTER_ORGANISATION IS NOT NULL THEN REQUESTER_ORGANISATION
           ELSE 'Citizen ' || UPPER(LEFT(SHA2(LOWER(TRIM(REQUESTER_NAME))),4)) END REQ_LABEL,
      COUNT(*) REQUESTS,
      SUM(IFF(IS_VEXATIOUS,1,0)) FLAGGED,
      ROUND(AVG(SENTIMENT_SCORE),2) AVG_SENTIMENT
    ${REAL_CORPUS}
    GROUP BY REQ_TYPE, REQ_LABEL
    HAVING COUNT(*) >= 1
    ORDER BY REQUESTS DESC, FLAGGED DESC, REQ_LABEL
    LIMIT ${limit}
  `)
  return rows.map((r) => ({
    label: String(r.REQ_LABEL),
    type: r.REQ_TYPE === "Organisation" ? "Organisation" : "Individual",
    requests: n(r.REQUESTS),
    flagged: n(r.FLAGGED),
    sentiment: r.AVG_SENTIMENT == null ? null : Number(r.AVG_SENTIMENT),
  }))
}

export interface WordWeight {
  term: string
  weight: number
}

// Common English + FOI/EIR domain stopwords. These dominate request text but
// carry no thematic signal, so they are stripped before counting.
const STOPWORDS = new Set([
  // structural english
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had", "her", "was", "one",
  "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see", "two",
  "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use", "this", "that", "with",
  "from", "your", "they", "have", "will", "would", "could", "should", "been", "were", "their", "them",
  "what", "when", "which", "into", "over", "such", "than", "then", "these", "those", "there", "here",
  "also", "about", "under", "above", "between", "each", "other", "some", "more", "most", "only", "very",
  "like", "just", "both", "being", "does", "doing", "during", "before", "after", "since", "while", "until",
  // foi/eir request boilerplate
  "request", "requests", "information", "please", "provide", "provided", "providing", "copy", "copies",
  "details", "detail", "relating", "regarding", "regard", "including", "include", "included", "data",
  "dear", "sincerely", "faithfully", "kind", "regards", "thank", "thanks", "would", "like", "under",
  "freedom", "act", "environmental", "regulations", "regulation", "council", "year", "years", "number",
  "numbers", "made", "make", "many", "much", "per", "total", "totals", "list", "lists", "held", "hold",
  "ask", "asked", "answer", "response", "respond", "questions", "question", "section", "subject",
  "access", "available", "following", "related", "concerning", "wish", "grateful", "received", "receive",
  // generic filler that surfaces as noise but carries no theme
  "last", "past", "next", "current", "recent", "previous", "given", "give", "send", "sent", "across",
  "again", "month", "months", "week", "weeks", "day", "days", "date", "dates", "time", "times", "period",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "first", "second", "third",
  "issued", "granted", "confirm", "confirmed", "reports", "report",
  // low-signal verbs/adverbs that surface as cloud noise without carrying a theme
  "down", "broken", "within", "spent",
  // council names / locality tokens that aren't themes
  "exampleton", "bristol", "shire", "borough", "county", "district", "metropolitan",
  // residual contact/signature noise (personal names are stripped via the signature block)
  "gmail", "outlook", "hotmail", "yahoo", "email", "mobile", "phone", "www", "http", "https",
])

/**
 * Word-frequency cloud over the real request corpus. Fetched per-request so we can strip the
 * signature block (personal name + contact details) and email/URL noise from each request before
 * tokenising — the cloud should surface FOI/SAR themes and organisation names, not requesters'
 * personal names. Tokenise here: lowercase, letters only, length >= 4, stopwords removed.
 */
const SIG_CLOSING = /\b(yours sincerely|yours faithfully|kind regards|best regards|best wishes|many thanks|thanks in advance|thank you|regards|sincerely|faithfully)\b/i

export async function getWordCloud(top = 45): Promise<WordWeight[]> {
  const rows = await querySnowflake(`SELECT REQUEST_TEXT AS T ${REAL_CORPUS}`)
  const counts = new Map<string, number>()
  for (const r of rows) {
    let t = String(r.T ?? "")
    // Drop the signature/closing block (personal name + contact block) from each request.
    const m = t.search(SIG_CLOSING)
    if (m >= 0) t = t.slice(0, m)
    t = t
      .toLowerCase()
      .replace(/\S+@\S+/g, " ") // email addresses
      .replace(/https?:\/\/\S+/g, " ") // URLs
    for (const raw of t.match(/[a-z][a-z'-]{3,}/g) ?? []) {
      const term = raw.replace(/^[''-]+|[''-]+$/g, "")
      if (term.length < 4 || STOPWORDS.has(term)) continue
      counts.set(term, (counts.get(term) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([term, weight]) => ({ term, weight }))
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
    .slice(0, top)
}

export interface CaseRow {
  reference: string
  subject: string
  regime: string
  stage: string
  status: string
  rag: string
  wdRemaining: number | null
  deadline: string | null
  ownerTitle: string
  department: string
  priorityBand: string
  complexity: number | null
  complexityFactors: string[]
  sentiment: number | null
  sentimentRationale: string
  precedentPct: number | null
}

export interface CaseFilters {
  stage?: string
  regime?: string
  risk?: "atrisk" | "overdue"
  status?: string
  /** Free-text term (from the Command Centre word cloud) matched against SUBJECT + REQUEST_TEXT. */
  keyword?: string
}

/**
 * Filtered case list for the Cases page. Reads from V_CASE (real corpus only).
 * Requester identity is never selected — the list is keyed on REFERENCE and
 * described by SUBJECT, so no personal data reaches the UI.
 */
export async function getCases(f: CaseFilters = {}, limit = 200): Promise<CaseRow[]> {
  const esc = (s: string) => s.replace(/'/g, "''")
  const where: string[] = ["NOT COALESCE(v.IS_SYNTHETIC, FALSE)"]
  // default lens: open work, unless a closed status is explicitly requested — but a
  // keyword drill-down (from the word cloud) should surface every matching case, open or closed.
  if (f.status) where.push(`v.STATUS = '${esc(f.status.toUpperCase())}'`)
  else if (!f.keyword) where.push("v.STATUS = 'OPEN'")
  if (f.stage) where.push(`v.STAGE_NAME = '${esc(f.stage)}'`)
  if (f.regime) where.push(`v.REGIME = '${esc(f.regime.toUpperCase())}'`)
  if (f.risk === "atrisk") where.push("(v.RAG = 'RED' OR v.WD_REMAINING < 0)")
  if (f.risk === "overdue") where.push("v.WD_REMAINING < 0")
  if (f.keyword) where.push(`(v.SUBJECT ILIKE '%${esc(f.keyword)}%' OR v.REQUEST_TEXT ILIKE '%${esc(f.keyword)}%')`)

  const rows = await querySnowflake(`
    SELECT v.REFERENCE, v.SUBJECT, v.REGIME, v.STAGE_NAME, v.STATUS, v.RAG,
           v.WD_REMAINING, v.STATUTORY_DEADLINE, v.OWNING_DEPARTMENT, v.PRIORITY_BAND,
           v.COMPLEXITY_RANK, v.SENTIMENT_SCORE,
           ofc.PERSONA AS OWNER_TITLE,
           tr.REASONING_JSON:complexity_factors AS FACTORS,
           tr.REASONING_JSON:sentiment_rationale::string AS RATIONALE,
           pm.SIMILARITY_PCT AS PRECEDENT_PCT
    FROM ${SCHEMA}.V_CASE v
    LEFT JOIN ${SCHEMA}.FOI_OFFICER ofc ON ofc.NAME = v.ASSIGNED_OFFICER
    LEFT JOIN ${SCHEMA}.FOI_TRIAGE tr ON tr.CASE_ID = v.CASE_ID
    LEFT JOIN ${SCHEMA}.FOI_PRECEDENT_MATCH pm ON pm.REFERENCE = v.REFERENCE
    WHERE ${where.join(" AND ")}
    ORDER BY (v.WD_REMAINING < 0) DESC, v.RAG = 'RED' DESC, v.WD_REMAINING ASC NULLS LAST
    LIMIT ${limit}
  `)
  return rows.map((r) => ({
    reference: String(r.REFERENCE ?? ""),
    subject: String(r.SUBJECT ?? "Untitled request"),
    regime: String(r.REGIME ?? ""),
    stage: String(r.STAGE_NAME ?? ""),
    status: String(r.STATUS ?? ""),
    rag: String(r.RAG ?? ""),
    wdRemaining: r.WD_REMAINING == null ? null : n(r.WD_REMAINING),
    deadline: r.STATUTORY_DEADLINE == null ? null : String(r.STATUTORY_DEADLINE),
    ownerTitle: String(r.OWNER_TITLE ?? "Case officer"),
    department: String(r.OWNING_DEPARTMENT ?? ""),
    priorityBand: String(r.PRIORITY_BAND ?? ""),
    complexity: r.COMPLEXITY_RANK == null ? null : Number(r.COMPLEXITY_RANK),
    complexityFactors: asStringArray(r.FACTORS),
    sentiment: r.SENTIMENT_SCORE == null ? null : Number(r.SENTIMENT_SCORE),
    sentimentRationale: String(r.RATIONALE ?? ""),
    precedentPct: r.PRECEDENT_PCT == null ? null : Number(r.PRECEDENT_PCT),
  }))
}

/**
 * Focus queue — the same open, non-synthetic cases as the list, ordered by
 * priority first, enriched with the request text + triage summary + precedent
 * title so the Focus deck can show triage, suggested-answer and a fast-track
 * precedent flag on a single card. Reuses CaseFilters (stage/regime/risk).
 */
export interface FocusCase extends CaseRow {
  caseId: string
  requestText: string
  priorityScore: number | null
  isVexatious: boolean
  category: string
  triageSummary: string
  departments: string[]
  estimatedHours: number | null
  precedentTitle: string
  precedentRef: string
  precedentOutcome: string
  outcome: string
  pitEngaged: boolean
  exemptionsApplied: number
}

export async function getFocusCases(f: CaseFilters = {}, limit = 100): Promise<FocusCase[]> {
  const where: string[] = ["NOT COALESCE(v.IS_SYNTHETIC, FALSE)"]
  if (f.status) where.push(`v.STATUS = '${esc(f.status.toUpperCase())}'`)
  else if (!f.keyword) where.push("v.STATUS = 'OPEN'")
  if (f.stage) where.push(`v.STAGE_NAME = '${esc(f.stage)}'`)
  if (f.regime) where.push(`v.REGIME = '${esc(f.regime.toUpperCase())}'`)
  if (f.risk === "atrisk") where.push("(v.RAG = 'RED' OR v.WD_REMAINING < 0)")
  if (f.risk === "overdue") where.push("v.WD_REMAINING < 0")
  if (f.keyword) where.push(`(v.SUBJECT ILIKE '%${esc(f.keyword)}%' OR v.REQUEST_TEXT ILIKE '%${esc(f.keyword)}%')`)

  const rows = await querySnowflake(`
    SELECT v.CASE_ID, v.REFERENCE, v.SUBJECT, v.REGIME, v.STAGE_NAME, v.STATUS, v.RAG,
           v.WD_REMAINING, v.STATUTORY_DEADLINE, v.OWNING_DEPARTMENT, v.PRIORITY_BAND, v.PRIORITY_SCORE,
           v.COMPLEXITY_RANK, v.SENTIMENT_SCORE, v.IS_VEXATIOUS, v.REQUEST_TEXT, v.OUTCOME,
           ofc.PERSONA AS OWNER_TITLE,
           tr.REASONING_JSON:complexity_factors AS FACTORS,
           tr.REASONING_JSON:sentiment_rationale::string AS RATIONALE,
           tr.TRIAGE_JSON:category::string AS CATEGORY,
           tr.TRIAGE_JSON:summary::string AS SUMMARY,
           tr.TRIAGE_JSON:suggested_departments AS DEPARTMENTS,
           tr.TRIAGE_JSON:estimated_hours::float AS HOURS,
           pm.SIMILARITY_PCT AS PRECEDENT_PCT,
           pm.TITLE AS PRECEDENT_TITLE, pm.REF AS PRECEDENT_REF, pm.CLEAN_OUTCOME AS PRECEDENT_OUTCOME,
           COALESCE(ex.PIT_ENGAGED, FALSE) AS PIT_ENGAGED,
           COALESCE(ex.EXEMPTIONS_APPLIED, 0) AS EXEMPTIONS_APPLIED
    FROM ${SCHEMA}.V_CASE v
    LEFT JOIN ${SCHEMA}.FOI_OFFICER ofc ON ofc.NAME = v.ASSIGNED_OFFICER
    LEFT JOIN ${SCHEMA}.FOI_TRIAGE tr ON tr.CASE_ID = v.CASE_ID
    LEFT JOIN ${SCHEMA}.FOI_PRECEDENT_MATCH pm ON pm.REFERENCE = v.REFERENCE
    LEFT JOIN (
      SELECT CASE_ID,
             BOOLOR_AGG(PIT_REQUIRED) AS PIT_ENGAGED,
             COUNT(DISTINCT CASE WHEN DECISION = 'apply' THEN SECTION_REF END) AS EXEMPTIONS_APPLIED
      FROM ${SCHEMA}.FOI_EXEMPTION_ASSESSMENT
      GROUP BY CASE_ID
    ) ex ON ex.CASE_ID = v.CASE_ID
    WHERE ${where.join(" AND ")}
    ORDER BY v.PRIORITY_SCORE DESC NULLS LAST, (v.WD_REMAINING < 0) DESC, v.RAG = 'RED' DESC, v.WD_REMAINING ASC NULLS LAST
    LIMIT ${limit}
  `)
  return rows.map((r) => ({
    caseId: String(r.CASE_ID ?? ""),
    reference: String(r.REFERENCE ?? ""),
    subject: String(r.SUBJECT ?? "Untitled request"),
    regime: String(r.REGIME ?? ""),
    stage: String(r.STAGE_NAME ?? ""),
    status: String(r.STATUS ?? ""),
    rag: String(r.RAG ?? ""),
    wdRemaining: r.WD_REMAINING == null ? null : n(r.WD_REMAINING),
    deadline: r.STATUTORY_DEADLINE == null ? null : String(r.STATUTORY_DEADLINE),
    ownerTitle: String(r.OWNER_TITLE ?? "Case officer"),
    department: String(r.OWNING_DEPARTMENT ?? ""),
    priorityBand: String(r.PRIORITY_BAND ?? ""),
    priorityScore: r.PRIORITY_SCORE == null ? null : Number(r.PRIORITY_SCORE),
    complexity: r.COMPLEXITY_RANK == null ? null : Number(r.COMPLEXITY_RANK),
    complexityFactors: asStringArray(r.FACTORS),
    sentiment: r.SENTIMENT_SCORE == null ? null : Number(r.SENTIMENT_SCORE),
    sentimentRationale: String(r.RATIONALE ?? ""),
    precedentPct: r.PRECEDENT_PCT == null ? null : Number(r.PRECEDENT_PCT),
    isVexatious: r.IS_VEXATIOUS === true,
    requestText: String(r.REQUEST_TEXT ?? ""),
    category: String(r.CATEGORY ?? ""),
    triageSummary: String(r.SUMMARY ?? ""),
    departments: asStringArray(r.DEPARTMENTS),
    estimatedHours: r.HOURS == null ? null : Number(r.HOURS),
    precedentTitle: String(r.PRECEDENT_TITLE ?? ""),
    precedentRef: String(r.PRECEDENT_REF ?? ""),
    precedentOutcome: String(r.PRECEDENT_OUTCOME ?? ""),
    outcome: String(r.OUTCOME ?? ""),
    pitEngaged: r.PIT_ENGAGED === true,
    exemptionsApplied: r.EXEMPTIONS_APPLIED == null ? 0 : n(r.EXEMPTIONS_APPLIED),
  }))
}

const esc = (s: string) => s.replace(/'/g, "''")

export interface CaseDetail {
  caseId: string
  reference: string
  subject: string
  requestText: string
  requester: string
  requesterType: "Organisation" | "Individual"
  regime: string
  status: string
  stage: string
  stageCode: string
  stageOrder: number
  rag: string
  wdRemaining: number | null
  deadline: string | null
  receivedDate: string | null
  closedDate: string | null
  ownerTitle: string
  department: string
  legalBasis: string
  outcome: string
  clockState: string
  workingDaysUsed: number | null
  sentiment: number | null
  isVexatious: boolean
  priorityBand: string
  source: string
}

/**
 * Full record for one case, keyed on its public REFERENCE. The requester is
 * shown as the organisation name where present, otherwise a stable hashed
 * "Citizen XXXX" surrogate computed inside Snowflake — the raw personal name is
 * never selected, consistent with the anonymisation used across the app.
 */
export async function getCaseDetail(reference: string): Promise<CaseDetail | null> {
  const rows = await querySnowflake(`
    SELECT CASE_ID, REFERENCE, SUBJECT, REQUEST_TEXT,
           CASE WHEN REQUESTER_ORGANISATION IS NOT NULL THEN 'Organisation' ELSE 'Individual' END REQ_TYPE,
           CASE WHEN REQUESTER_ORGANISATION IS NOT NULL THEN REQUESTER_ORGANISATION
                ELSE 'Citizen ' || UPPER(LEFT(SHA2(LOWER(TRIM(REQUESTER_NAME))),4)) END REQUESTER,
           REGIME, STATUS, STAGE_NAME, CURRENT_STAGE, STAGE_ORDER, RAG, WD_REMAINING, STATUTORY_DEADLINE,
           RECEIVED_DATE, CLOSED_DATE, ofc.PERSONA AS OWNER_TITLE, OWNING_DEPARTMENT, LEGAL_BASIS, OUTCOME,
           CLOCK_STATE, WORKING_DAYS_USED, SENTIMENT_SCORE, IS_VEXATIOUS, PRIORITY_BAND, SOURCE
    FROM ${SCHEMA}.V_CASE
    LEFT JOIN ${SCHEMA}.FOI_OFFICER ofc ON ofc.NAME = ASSIGNED_OFFICER
    WHERE REFERENCE = '${esc(reference)}'
    LIMIT 1
  `)
  if (!rows.length) return null
  const r = rows[0]
  return {
    caseId: String(r.CASE_ID ?? ""),
    reference: String(r.REFERENCE ?? ""),
    subject: String(r.SUBJECT ?? "Untitled request"),
    requestText: String(r.REQUEST_TEXT ?? ""),
    requester: String(r.REQUESTER ?? "Unknown"),
    requesterType: r.REQ_TYPE === "Organisation" ? "Organisation" : "Individual",
    regime: String(r.REGIME ?? ""),
    status: String(r.STATUS ?? ""),
    stage: String(r.STAGE_NAME ?? ""),
    stageCode: String(r.CURRENT_STAGE ?? ""),
    stageOrder: n(r.STAGE_ORDER),
    rag: String(r.RAG ?? ""),
    wdRemaining: r.WD_REMAINING == null ? null : n(r.WD_REMAINING),
    deadline: r.STATUTORY_DEADLINE == null ? null : String(r.STATUTORY_DEADLINE),
    receivedDate: r.RECEIVED_DATE == null ? null : String(r.RECEIVED_DATE),
    closedDate: r.CLOSED_DATE == null ? null : String(r.CLOSED_DATE),
    ownerTitle: String(r.OWNER_TITLE ?? "Case officer"),
    department: String(r.OWNING_DEPARTMENT ?? ""),
    legalBasis: String(r.LEGAL_BASIS ?? ""),
    outcome: String(r.OUTCOME ?? ""),
    clockState: String(r.CLOCK_STATE ?? ""),
    workingDaysUsed: r.WORKING_DAYS_USED == null ? null : n(r.WORKING_DAYS_USED),
    sentiment: r.SENTIMENT_SCORE == null ? null : Number(r.SENTIMENT_SCORE),
    isVexatious: r.IS_VEXATIOUS === true,
    priorityBand: String(r.PRIORITY_BAND ?? ""),
    source: String(r.SOURCE ?? ""),
  }
}

export interface CaseEvent {
  ts: string
  fromStage: string
  toStage: string
  actorType: string
  actor: string
  eventType: string
  note: string
}

export async function getCaseTimeline(caseId: string): Promise<CaseEvent[]> {
  const rows = await querySnowflake(`
    SELECT EVENT_TS, FROM_STAGE, TO_STAGE, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE
    FROM ${SCHEMA}.FOI_CASE_EVENT
    WHERE CASE_ID = '${esc(caseId)}'
    ORDER BY EVENT_TS DESC
  `)
  return rows.map((r) => ({
    ts: r.EVENT_TS == null ? "" : String(r.EVENT_TS),
    fromStage: String(r.FROM_STAGE ?? ""),
    toStage: String(r.TO_STAGE ?? ""),
    actorType: String(r.ACTOR_TYPE ?? ""),
    actor: String(r.ACTOR ?? ""),
    eventType: String(r.EVENT_TYPE ?? ""),
    note: String(r.NOTE ?? ""),
  }))
}

export interface Exemption {
  assessmentId: string
  sectionRef: string
  exemptionType: string
  pitRequired: boolean
  pitFor: string
  pitAgainst: string
  decision: string
}

export async function getCaseExemptions(caseId: string): Promise<Exemption[]> {
  const rows = await querySnowflake(`
    SELECT ASSESSMENT_ID, SECTION_REF, EXEMPTION_TYPE, PIT_REQUIRED, PIT_FOR, PIT_AGAINST, DECISION
    FROM ${SCHEMA}.FOI_EXEMPTION_ASSESSMENT
    WHERE CASE_ID = '${esc(caseId)}'
    ORDER BY SECTION_REF
  `)
  return rows.map((r) => ({
    assessmentId: String(r.ASSESSMENT_ID ?? ""),
    sectionRef: String(r.SECTION_REF ?? ""),
    exemptionType: String(r.EXEMPTION_TYPE ?? ""),
    pitRequired: r.PIT_REQUIRED === true,
    pitFor: String(r.PIT_FOR ?? ""),
    pitAgainst: String(r.PIT_AGAINST ?? ""),
    decision: String(r.DECISION ?? ""),
  }))
}

export interface CostEstimate {
  totalHours: number | null
  totalGbp: number | null
  limitGbp: number | null
  exceedsLimit: boolean
  note: string
}

export async function getCaseCost(caseId: string): Promise<CostEstimate | null> {
  const rows = await querySnowflake(`
    SELECT TOTAL_HOURS, TOTAL_GBP, LIMIT_GBP, EXCEEDS_LIMIT, NOTE
    FROM ${SCHEMA}.FOI_COST_ESTIMATE
    WHERE CASE_ID = '${esc(caseId)}'
    ORDER BY CREATED_AT DESC
    LIMIT 1
  `)
  if (!rows.length) return null
  const r = rows[0]
  return {
    totalHours: r.TOTAL_HOURS == null ? null : Number(r.TOTAL_HOURS),
    totalGbp: r.TOTAL_GBP == null ? null : Number(r.TOTAL_GBP),
    limitGbp: r.LIMIT_GBP == null ? null : Number(r.LIMIT_GBP),
    exceedsLimit: r.EXCEEDS_LIMIT === true,
    note: String(r.NOTE ?? ""),
  }
}

// FOI redaction (s.40/s.43 etc.) — AI-suggested excerpts pre-populated into
// FOI_REDACTION; the officer verifies each (the highest-risk HITL gate). This is
// the FOI counterpart to the SAR third-party redaction flow.
export interface FoiRedaction {
  redactionId: string
  excerpt: string
  basisSection: string
  verified: boolean
  verifiedBy: string
}

export async function getFoiRedactions(caseId: string): Promise<FoiRedaction[]> {
  const rows = await querySnowflake(`
    SELECT REDACTION_ID, EXCERPT, BASIS_SECTION, VERIFIED, VERIFIED_BY
    FROM ${SCHEMA}.FOI_REDACTION
    WHERE CASE_ID = '${esc(caseId)}'
    ORDER BY VERIFIED, BASIS_SECTION
  `)
  return rows.map((r) => ({
    redactionId: String(r.REDACTION_ID ?? ""),
    excerpt: String(r.EXCERPT ?? ""),
    basisSection: String(r.BASIS_SECTION ?? ""),
    verified: r.VERIFIED === true,
    verifiedBy: String(r.VERIFIED_BY ?? ""),
  }))
}

// Resolve a case's UUID from its public reference (open or closed).
async function caseIdFromRef(reference: string): Promise<string | null> {
  const rows = await querySnowflake(
    `SELECT CASE_ID FROM ${SCHEMA}.FOI_CASE WHERE REFERENCE = '${esc(reference)}' LIMIT 1`,
  )
  return rows.length ? String(rows[0].CASE_ID ?? "") : null
}

const CLOCK_STOP_REASONS = new Set(["STOPPED_CLARIFICATION", "STOPPED_FEES", "PIT_EXTENSION"])

/** Stop or resume the statutory clock via the stored procedures. */
export async function setCaseClock(
  reference: string,
  action: "stop" | "resume",
  reason?: string,
): Promise<{ ok: boolean }> {
  const caseId = await caseIdFromRef(reference)
  if (!caseId) return { ok: false }
  if (action === "stop") {
    const r = reason && CLOCK_STOP_REASONS.has(reason) ? reason : "STOPPED_CLARIFICATION"
    await querySnowflake(
      `CALL ${SCHEMA}.SP_STOP_CLOCK('${esc(caseId)}', '${esc(r)}', 'FOI Officer', 'Clock stopped from case page')`,
    )
  } else {
    await querySnowflake(`CALL ${SCHEMA}.SP_RESUME_CLOCK('${esc(caseId)}', 'FOI Officer')`)
  }
  return { ok: true }
}

/** Recalculate the s.12 cost estimate from the four prescribed-activity hours. */
export async function recalcCost(
  reference: string,
  hours: { determine: number; locate: number; retrieve: number; extract: number },
): Promise<{ ok: boolean }> {
  const caseId = await caseIdFromRef(reference)
  if (!caseId) return { ok: false }
  const num = (v: number) => (Number.isFinite(v) && v >= 0 ? v : 0)
  await querySnowflake(
    `CALL ${SCHEMA}.SP_COST_ESTIMATE('${esc(caseId)}', ${num(hours.determine)}, ${num(hours.locate)}, ${num(hours.retrieve)}, ${num(hours.extract)})`,
  )
  return { ok: true }
}

/** Record a human PIT decision on a qualified exemption. */
export async function decideExemption(
  reference: string,
  assessmentId: string,
  decision: "apply" | "disclose",
): Promise<{ ok: boolean }> {
  const caseId = await caseIdFromRef(reference)
  if (!caseId) return { ok: false }
  const d = decision === "apply" ? "APPLY" : "DO_NOT_APPLY"
  await querySnowflake(`
    UPDATE ${SCHEMA}.FOI_EXEMPTION_ASSESSMENT
    SET DECISION = '${d}', DECIDED_BY = 'FOI Officer', DECIDED_AT = CURRENT_TIMESTAMP()
    WHERE ASSESSMENT_ID = '${esc(assessmentId)}' AND CASE_ID = '${esc(caseId)}'
  `)
  return { ok: true }
}

/** Mark an FOI redaction human-verified. */
export async function verifyFoiRedaction(reference: string, redactionId: string): Promise<{ ok: boolean }> {
  const caseId = await caseIdFromRef(reference)
  if (!caseId) return { ok: false }
  await querySnowflake(`
    UPDATE ${SCHEMA}.FOI_REDACTION
    SET VERIFIED = TRUE, VERIFIED_BY = 'FOI Officer'
    WHERE REDACTION_ID = '${esc(redactionId)}' AND CASE_ID = '${esc(caseId)}'
  `)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Response & Refusal Studio — generate a s.17(7)-compliant disclosure/refusal
// letter with Cortex (SP_GENERATE_RESPONSE), review/edit it, save as final, and
// dispatch (which closes the case). Powers /studio and the case-detail Responses
// card. Ported from 05_app/app_pages/response_studio.py.
// ---------------------------------------------------------------------------

export type ResponseType = "DISCLOSURE" | "PARTIAL" | "REFUSAL" | "S21_REUSE"
const RESPONSE_TYPES = new Set<ResponseType>(["DISCLOSURE", "PARTIAL", "REFUSAL", "S21_REUSE"])

export interface ResponseDraft {
  responseId: string
  responseType: string
  draftText: string
  finalText: string
  s17ExemptionStated: boolean
  s17InternalReview: boolean
  s17IcoRoute: boolean
  signedOffBy: string
  dispatchedAt: string | null
  createdAt: string | null
  /** Provenance trail for grounded letters: which sources/tables the figures came from. */
  sources?: AnswerSource[]
}

export async function getResponses(caseId: string): Promise<ResponseDraft[]> {
  const rows = await querySnowflake(`
    SELECT RESPONSE_ID, RESPONSE_TYPE, DRAFT_TEXT, FINAL_TEXT,
           S17_EXEMPTION_STATED, S17_INTERNAL_REVIEW_INCLUDED, S17_ICO_ROUTE_INCLUDED,
           SIGNED_OFF_BY, DISPATCHED_AT, CREATED_AT, TO_VARCHAR(SOURCES) AS SOURCES
    FROM ${SCHEMA}.FOI_RESPONSE
    WHERE CASE_ID = '${esc(caseId)}'
    ORDER BY CREATED_AT DESC
  `)
  return rows.map((r) => ({
    responseId: String(r.RESPONSE_ID ?? ""),
    responseType: String(r.RESPONSE_TYPE ?? ""),
    draftText: String(r.DRAFT_TEXT ?? ""),
    finalText: String(r.FINAL_TEXT ?? ""),
    s17ExemptionStated: r.S17_EXEMPTION_STATED === true,
    s17InternalReview: r.S17_INTERNAL_REVIEW_INCLUDED === true,
    s17IcoRoute: r.S17_ICO_ROUTE_INCLUDED === true,
    signedOffBy: String(r.SIGNED_OFF_BY ?? ""),
    dispatchedAt: r.DISPATCHED_AT == null ? null : String(r.DISPATCHED_AT),
    createdAt: r.CREATED_AT == null ? null : String(r.CREATED_AT),
    sources: parseAnswerSources(r.SOURCES),
  }))
}

/** Open cases for the studio picker (reference + subject + stage). */
export async function getOpenCaseOptions(): Promise<{ reference: string; subject: string; regime: string; stage: string }[]> {
  const rows = await querySnowflake(`
    SELECT REFERENCE, SUBJECT, REGIME, STAGE_NAME
    FROM ${SCHEMA}.V_CASE
    WHERE STATUS = 'OPEN' AND NOT COALESCE(IS_SYNTHETIC, FALSE)
    ORDER BY WD_REMAINING ASC NULLS LAST
  `)
  return rows.map((r) => ({
    reference: String(r.REFERENCE ?? ""),
    subject: String(r.SUBJECT ?? "Untitled request"),
    regime: String(r.REGIME ?? ""),
    stage: String(r.STAGE_NAME ?? ""),
  }))
}

/** Generate a compliant draft for a case via SP_GENERATE_RESPONSE (Cortex inside). */
export async function generateResponse(reference: string, type: ResponseType, usePrecedent = false): Promise<{ ok: boolean }> {
  const caseId = await caseIdFromRef(reference)
  if (!caseId) return { ok: false }
  const t = RESPONSE_TYPES.has(type) ? type : "DISCLOSURE"
  // Grounded path: cite real figures from verified sources + persist provenance, rather than the
  // ungrounded SP_GENERATE_RESPONSE (which fabricates figures and carries no source trail).
  // When the officer has adopted the precedent, pin it as the top source so the letter mirrors it.
  let pinned: PinnedPrecedent | undefined
  if (usePrecedent) {
    const m = await getPrecedentMatch(reference)
    if (m && m.responseText.trim()) {
      pinned = { ref: m.ref, title: m.title, responseText: m.responseText, source: m.source }
    }
  }
  const result = await generateGroundedLetter(reference, t, undefined, pinned)
  return { ok: Boolean(result?.letter) }
}

/**
 * Revise an existing draft in place per an officer's plain-language instruction
 * (Cortex COMPLETE). Returns the revised text for review — does NOT save or
 * dispatch, so the human stays in the loop.
 */
export async function editDraftWithAI(currentText: string, instruction: string): Promise<{ ok: boolean; text: string }> {
  const draft = (currentText ?? "").trim()
  const ask = (instruction ?? "").trim()
  if (!draft || !ask) return { ok: false, text: "" }
  const prompt =
    "You are an FOI officer at a UK local authority revising a draft response to a requester. " +
    "Apply the officer's instruction to the draft below. " +
    "Keep it plain text only (no markdown, asterisks, headings or bracketed placeholders), keep a professional local-authority tone, " +
    "and PRESERVE the statutory paragraphs offering an internal review and the right to complain to the ICO. " +
    "Return ONLY the revised message, nothing else.\n\n" +
    "OFFICER INSTRUCTION:\n" + ask + "\n\nCURRENT DRAFT:\n" + draft + "\n\nRevised message:"
  const rows = await querySnowflakeLongRunning(
    `SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '${escLit(prompt)}') AS R`,
  )
  const text = String(rows[0]?.R ?? "").trim()
  if (!text) return { ok: false, text: "" }
  return { ok: true, text }
}

/** Save an officer-edited draft as the final text. */
export async function saveResponseFinal(reference: string, responseId: string, finalText: string): Promise<{ ok: boolean }> {
  const caseId = await caseIdFromRef(reference)
  if (!caseId) return { ok: false }
  await querySnowflake(`
    UPDATE ${SCHEMA}.FOI_RESPONSE
    SET FINAL_TEXT = '${escLit(finalText)}', SIGNED_OFF_BY = 'FOI Officer'
    WHERE RESPONSE_ID = '${esc(responseId)}' AND CASE_ID = '${esc(caseId)}'
  `)
  // A5 learning loop: record how much the officer changed the AI draft (EDITDISTANCE).
  // Low EDIT_RATIO => the AI draft was accepted near-verbatim; high => it was rewritten.
  try {
    await querySnowflake(`
      INSERT INTO ${SCHEMA}.AI_DRAFT_FEEDBACK (RESPONSE_ID, CASE_REF, DRAFT_CHARS, FINAL_CHARS, EDIT_DISTANCE, EDIT_RATIO)
      SELECT RESPONSE_ID, '${escLit(reference)}',
        LENGTH(DRAFT_TEXT), LENGTH('${escLit(finalText)}'),
        EDITDISTANCE(LEFT(DRAFT_TEXT, 4000), LEFT('${escLit(finalText)}', 4000)),
        EDITDISTANCE(LEFT(DRAFT_TEXT, 4000), LEFT('${escLit(finalText)}', 4000))
          / NULLIF(GREATEST(LENGTH(LEFT(DRAFT_TEXT, 4000)), LENGTH(LEFT('${escLit(finalText)}', 4000))), 0)
      FROM ${SCHEMA}.FOI_RESPONSE
      WHERE RESPONSE_ID = '${esc(responseId)}' AND CASE_ID = '${esc(caseId)}' AND DRAFT_TEXT IS NOT NULL
    `)
  } catch (e) {
    console.warn("[ai-feedback] edit-distance capture failed (non-fatal):", e instanceof Error ? e.message : e)
  }
  return { ok: true }
}

/** Dispatch a response: timestamp it, close the case, log the dispatch event. */
export async function dispatchResponse(
  reference: string,
  responseId: string,
  eventNote = "Response dispatched",
): Promise<{ ok: boolean }> {
  const caseId = await caseIdFromRef(reference)
  if (!caseId) return { ok: false }
  const typeRows = await querySnowflake(
    `SELECT RESPONSE_TYPE FROM ${SCHEMA}.FOI_RESPONSE WHERE RESPONSE_ID = '${esc(responseId)}' AND CASE_ID = '${esc(caseId)}' LIMIT 1`,
  )
  const rt = String(typeRows[0]?.RESPONSE_TYPE ?? "DISCLOSURE").toUpperCase()
  const outcome = RESPONSE_TYPE_TO_OUTCOME[rt] ?? "GRANTED_FULL"
  await querySnowflake(`
    UPDATE ${SCHEMA}.FOI_RESPONSE SET DISPATCHED_AT = CURRENT_TIMESTAMP()
    WHERE RESPONSE_ID = '${esc(responseId)}' AND CASE_ID = '${esc(caseId)}'
  `)
  await querySnowflake(`
    UPDATE ${SCHEMA}.FOI_CASE
    SET STATUS = 'CLOSED', CURRENT_STAGE = 'DISPATCH', CLOSED_DATE = CURRENT_DATE(),
        OUTCOME = '${esc(outcome)}',
        ANSWERED_IN_TIME = (CURRENT_DATE() <= STATUTORY_DEADLINE)
    WHERE CASE_ID = '${esc(caseId)}'
  `)
  await querySnowflake(
    `CALL ${SCHEMA}.SP_ADVANCE_STAGE('${esc(caseId)}', 'DISPATCH', 'HUMAN', 'FOI Officer', '${escLit(eventNote)}')`,
  )
  return { ok: true }
}

const RESPONSE_TYPE_TO_OUTCOME: Record<string, string> = {
  DISCLOSURE: "GRANTED_FULL",
  PARTIAL: "GRANTED_PARTIAL",
  REFUSAL: "REFUSED",
  S21_REUSE: "S21_REUSE",
}

/**
 * Suggest the correct response outcome for a case from its triage, exemption
 * assessments and recorded outcome — mirrors the case-detail page logic. Used by
 * the automated paths (batch dispatch, intake, focus deck) so responses vary
 * (partial / refusal / already-published) rather than always being a full
 * disclosure.
 */
export async function suggestedResponseType(
  reference: string,
): Promise<{ type: ResponseType; reason: string }> {
  const caseId = await caseIdFromRef(reference)
  if (!caseId) return { type: "DISCLOSURE", reason: "No exemptions engaged; release in full." }
  const [triage, exemptions, outcomeRows] = await Promise.all([
    getCaseTriage(caseId),
    getCaseExemptions(caseId),
    querySnowflake(`SELECT OUTCOME FROM ${SCHEMA}.FOI_CASE WHERE CASE_ID = '${esc(caseId)}' LIMIT 1`),
  ])
  const outcome = String(outcomeRows[0]?.OUTCOME ?? "").toUpperCase()
  if (triage?.s21MatchRef || outcome === "S21_REUSE") {
    return {
      type: "S21_REUSE",
      reason: triage?.s21MatchRef ? `Already published; matches ${triage.s21MatchRef}.` : "Already published; disposed under s.21.",
    }
  }
  const applied = exemptions.filter((e) => e.decision.toLowerCase() === "apply")
  const disclosed = exemptions.filter((e) => e.decision.toLowerCase() === "disclose")
  if (applied.length > 0) {
    const secs = [...new Set(applied.map((e) => e.sectionRef).filter(Boolean))].join(", ")
    if (disclosed.length > 0) return { type: "PARTIAL", reason: secs ? `${secs} applies to part of the information.` : "Some information withheld under exemptions." }
    return { type: "REFUSAL", reason: secs ? `${secs} applies to the requested information.` : "Information withheld under exemptions." }
  }
  if (outcome === "GRANTED_PARTIAL") return { type: "PARTIAL", reason: "Recorded as granted in part." }
  if (outcome === "REFUSED") return { type: "REFUSAL", reason: "Recorded as refused." }
  return { type: "DISCLOSURE", reason: "No exemptions engaged; release in full." }
}

/**
 * Batch-dispatch the quick-win lane: for each reference, reuse the existing
 * single-case logic — find an undispatched draft (generating one with
 * SP_GENERATE_RESPONSE if none exists), promote it to final text if blank, then
 * dispatch (which closes the case). Returns a per-reference result so the UI can
 * report partial success. Sequential to stay within Cortex concurrency limits.
 */
export async function batchDispatch(
  references: string[],
): Promise<{ reference: string; ok: boolean; error?: string }[]> {
  const out: { reference: string; ok: boolean; error?: string }[] = []
  for (const reference of references.slice(0, 25)) {
    try {
      if (!/^[A-Za-z0-9-]+$/.test(reference)) { out.push({ reference, ok: false, error: "Invalid reference" }); continue }
      const caseId = await caseIdFromRef(reference)
      if (!caseId) { out.push({ reference, ok: false, error: "Case not found" }); continue }
      let drafts = await getResponses(caseId)
      let draft = drafts.find((d) => !d.dispatchedAt)
      if (!draft) {
        // Grounded fallback: generate a cited letter of the correct outcome type
        // (disclosure / partial / refusal / s.21) from verified sources.
        const { type } = await suggestedResponseType(reference)
        await generateGroundedLetter(reference, type)
        drafts = await getResponses(caseId)
        draft = drafts.find((d) => !d.dispatchedAt)
      }
      if (!draft) { out.push({ reference, ok: false, error: "No draft" }); continue }
      if (!draft.finalText.trim()) await saveResponseFinal(reference, draft.responseId, draft.draftText)
      await dispatchResponse(reference, draft.responseId, "Response dispatched \u2014 officer-confirmed quick-win batch")
      out.push({ reference, ok: true })
    } catch (e) {
      out.push({ reference, ok: false, error: e instanceof Error ? e.message : "Failed" })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Cortex Search + agentic answer suggestion. Grounds a draft answer in the
// internal "clean" corpora (WhatDoTheyKnow, GLA disclosure log, council policy)
// via SEARCH_PREVIEW, then drafts with COMPLETE citing each source.
// ---------------------------------------------------------------------------

/** Query a Cortex Search service; returns the parsed results array. */
export async function cortexSearch(
  service: string,
  query: string,
  columns: string[],
  limit = 4,
  filter?: Record<string, unknown>,
  minReranker?: number,
): Promise<Record<string, unknown>[]> {
  const spec = JSON.stringify({ query: query.slice(0, 1000), columns, limit, ...(filter ? { filter } : {}) })
  const rows = await querySnowflake(
    `SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW('${SCHEMA}.${service}', '${escLit(spec)}') AS R`,
  )
  try {
    const parsed = JSON.parse(String(rows[0]?.R ?? "{}"))
    const results: Record<string, unknown>[] = Array.isArray(parsed.results) ? parsed.results : []
    // Relevance guard: drop clearly off-topic hits by reranker score. Thin/low-diversity peer
    // corpora otherwise return the same weak chunk for every query (robustness battery finding),
    // injecting noise into grounded letters. Missing scores are kept (fail-open).
    if (typeof minReranker === "number") {
      return results.filter((r) => {
        const s = (r as { "@scores"?: { reranker_score?: number } })["@scores"]?.reranker_score
        return typeof s !== "number" || s >= minReranker
      })
    }
    return results
  } catch {
    return []
  }
}

/** Reranker floor for external peer-comparison corpora (WDTK/GLA/Camden/Brentwood). Calibrated
 * against real case queries: genuinely relevant peers score above ~-3 (Camden ~+0.2, GLA/WDTK
 * ~-2); thin-corpus noise (Brentwood's 2-doc set) scores below -4. Peer sources are comparison-
 * only, so dropping a weak one never costs a grounded figure (verified sources are unfiltered). */
const PEER_RERANK_FLOOR = -4

export interface AnswerSource {
  tag: string
  origin: string
  title: string
  url: string
  snippet: string
  /** Realistically-named LA line-of-business table this came from (provenance). */
  sourceTable?: string
  /** Council service / system that owns the source. */
  owningService?: string
  /** TRUE = authoritative internal Exampleton source; FALSE = external/peer reference. */
  verified?: boolean
  /** INTERNAL_RECORD | OWN_REPLY | OWN_POLICY | OWN_DISCLOSURE | PEER_AUTHORITY */
  sourceKind?: string
}

interface SourceRegistryEntry {
  sourceTable: string
  owningService: string
  verified: boolean
  sourceKind: string
}

let _sourceRegistry: Map<string, SourceRegistryEntry> | null = null
/** Load the DATA_SOURCE_REGISTRY trust catalogue (cached). Keyed by SOURCE_KEY. */
async function getSourceRegistry(): Promise<Map<string, SourceRegistryEntry>> {
  if (_sourceRegistry) return _sourceRegistry
  const m = new Map<string, SourceRegistryEntry>()
  try {
    const rows = await querySnowflake(
      `SELECT SOURCE_KEY, SOURCE_TABLE, OWNING_SERVICE, VERIFIED, SOURCE_KIND FROM ${SCHEMA}.DATA_SOURCE_REGISTRY`,
    )
    for (const r of rows) {
      m.set(String(r.SOURCE_KEY ?? ""), {
        sourceTable: String(r.SOURCE_TABLE ?? ""),
        owningService: String(r.OWNING_SERVICE ?? ""),
        verified: r.VERIFIED === true,
        sourceKind: String(r.SOURCE_KIND ?? ""),
      })
    }
  } catch {
    /* registry optional — provenance simply omitted if unavailable */
  }
  _sourceRegistry = m
  return m
}

export interface AnswerSuggestion {
  answer: string
  sources: AnswerSource[]
  grounded: boolean
}

/**
 * Draft a suggested answer for a case, grounded in Cortex Search results across
 * the internal corpora, with inline [S1] citations.
 */
/** Parse a stored SOURCES VARIANT (string or object) into AnswerSource[] with provenance fields. */
function parseAnswerSources(raw: unknown): AnswerSource[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return []
    return parsed.map((s: Record<string, unknown>) => ({
      tag: String(s.tag ?? ""),
      origin: String(s.origin ?? ""),
      title: String(s.title ?? ""),
      url: String(s.url ?? ""),
      snippet: String(s.snippet ?? ""),
      ...(s.sourceTable ? { sourceTable: String(s.sourceTable) } : {}),
      ...(s.owningService ? { owningService: String(s.owningService) } : {}),
      ...(typeof s.verified === "boolean" ? { verified: s.verified } : {}),
      ...(s.sourceKind ? { sourceKind: String(s.sourceKind) } : {}),
    }))
  } catch {
    return []
  }
}

/**
 * Shared retrieval for grounded drafting: fetch the case, fan out across the internal +
 * peer Cortex Search corpora, resolve the dominant internal-holdings theme(s), and build a
 * ranked, provenance-tagged AnswerSource[] (verified internal figures first). Reused by both
 * the short suggested-answer and the full grounded letter so both cite the same real sources.
 */
async function gatherGroundedSources(
  reference: string,
): Promise<{ q: string; sources: AnswerSource[] } | null> {
  const caseRows = await querySnowflake(
    `SELECT SUBJECT, REQUEST_TEXT FROM ${SCHEMA}.FOI_CASE WHERE REFERENCE = '${esc(reference)}' LIMIT 1`,
  )
  if (!caseRows.length) return null
  const subject = String(caseRows[0].SUBJECT ?? "")
  const requestText = String(caseRows[0].REQUEST_TEXT ?? "")
  const q = `${subject} ${requestText}`.trim().slice(0, 1200)
  // Theme detection for internal holdings uses the SUBJECT (high-signal) rather than the
  // full body, whose email signatures / boilerplate skew the semantic match to the wrong theme.
  const internalQuery = (subject && subject.length > 12 ? subject : q).slice(0, 400)

  const [ownReplies, wdtk, gla, camden, policy, brentwood, disclosure, internalHits, legislation] = await Promise.all([
    cortexSearch("OWN_REPLY_SEARCH", q, ["REFERENCE", "SUBJECT", "REGIME", "RESPONSE_TYPE", "FINAL_TEXT"], 2),
    cortexSearch("WDTK_PRECEDENT_SEARCH", q, ["AUTHORITY_NAME", "OUTCOME", "REQUEST_TITLE", "REQUEST_URL", "SNIPPET"], 3, undefined, PEER_RERANK_FLOOR),
    cortexSearch("GLA_DISCLOSURE_SEARCH", q, ["REFERENCE_NUMBER", "TITLE", "RESPONSE_TEXT", "SOURCE_URL"], 2, undefined, PEER_RERANK_FLOOR),
    cortexSearch("CAMDEN_FOI_SEARCH", q, ["IDENTIFIER", "DOCUMENT_TITLE", "DOCUMENT_TEXT"], 2, undefined, PEER_RERANK_FLOOR),
    cortexSearch("COUNCIL_POLICY_SEARCH", q, ["DOC_TITLE", "SECTION_REF", "CONTENT"], 2),
    cortexSearch("BRENTWOOD_FOI_SEARCH", q, ["TEXT", "DOC"], 2, undefined, PEER_RERANK_FLOOR),
    cortexSearch("DISCLOSURE_SEARCH", q, ["REFERENCE_NUMBER", "TOPIC", "REQUEST_SUMMARY", "RESPONSE_SUMMARY"], 2),
    cortexSearch("INTERNAL_HOLDINGS_SEARCH", internalQuery, ["THEME"], 8),
    // Authoritative FOIA/EIR statute + Code of Practice, for grounding the legal basis / exemption
    // reasoning. Verified reference source; a light floor drops off-topic sections on disclosure-only cases.
    cortexSearch("FOI_LEGISLATION_SEARCH", q, ["SECTION_REF", "TITLE", "SUMMARY"], 2, undefined, -3),
  ])
  const camdenLinks = await getCamdenLinks(camden.map((r) => String(r.IDENTIFIER ?? "")))

  // Internal holdings: use the search only to identify the dominant theme(s), then pull the
  // COMPLETE set of facts for those themes. List-style FOI requests ("all officers over
  // £100k") must not be truncated by semantic top-k, which returns a partial list.
  let internal: Record<string, unknown>[] = []
  {
    const themeCounts = new Map<string, number>()
    let topTheme = ""
    for (const r of internalHits) {
      const t = String(r.THEME ?? "").trim()
      if (!t) continue
      if (!topTheme) topTheme = t
      themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1)
    }
    const themes = new Set<string>()
    // Only trust the top theme when the search points to it consistently (>=2 of the hits).
    // A single weak hit means the request has no matching internal holdings - pushing those
    // off-topic facts floods the prompt and forces placeholder non-answers (0 groundedness).
    if (topTheme && (themeCounts.get(topTheme) ?? 0) >= 2) themes.add(topTheme)
    for (const [t, c] of themeCounts) if (c >= 3) themes.add(t)
    if (themes.size) {
      const inList = [...themes].map((t) => `'${esc(t)}'`).join(",")
      internal = await querySnowflake(
        `SELECT FACT_TEXT, THEME, PERIOD, METRIC, SOURCE_TABLE, SOURCE_SYSTEM FROM ${SCHEMA}.COUNCIL_INTERNAL_HOLDINGS_FACTS
          WHERE THEME IN (${inList}) ORDER BY THEME, PERIOD DESC, VALUE DESC LIMIT 10`,
      )
    }
  }

  const registry = await getSourceRegistry()
  const sources: AnswerSource[] = []
  // regKey resolves the trust catalogue entry: internal facts key on their SOURCE_TABLE, everything
  // else keys on its origin string (both are registered in DATA_SOURCE_REGISTRY).
  const push = (origin: string, title: string, url: string, snippet: string, regKey?: string) => {
    const s = (snippet ?? "").trim()
    if (!s) return
    const reg = registry.get(regKey ?? origin)
    sources.push({
      tag: `S${sources.length + 1}`,
      origin,
      title: title || origin,
      url,
      snippet: s.slice(0, 400),
      ...(reg ? { sourceTable: reg.sourceTable, owningService: reg.owningService, verified: reg.verified, sourceKind: reg.sourceKind } : {}),
    })
  }
  // Curated real WhatDoTheyKnow disclosures for the matched theme(s) - genuine peer figures.
  let wdtkReal: Record<string, unknown>[] = []
  if (internal.length) {
    const themeList = [...new Set(internal.map((r) => String(r.THEME ?? "")).filter(Boolean))].map((t) => `'${esc(t)}'`).join(",")
    if (themeList) {
      wdtkReal = await querySnowflake(
        `SELECT AUTHORITY_NAME, REQUEST_TITLE, RESPONSE_BODY, PROVENANCE_URL
           FROM ${SCHEMA}.WDTK_RESPONSE_BODY WHERE THEME IN (${themeList}) LIMIT 3`,
      )
    }
  }
  // Internal holdings pushed FIRST so the disclosable figures take the S1/S2 slots the prompt
  // prioritises for grounding.
  for (const r of internal) push("This council's records", String(r.METRIC ?? r.THEME ?? ""), "", String(r.FACT_TEXT ?? ""), String(r.SOURCE_TABLE ?? ""))
  // The council's OWN previously-sent replies to similar requests, placed just after the factual
  // sources: they inform tone/structure/phrasing (flywheel) without displacing grounding. Snippet
  // kept short so reused boilerplate does not swamp the factual context.
  for (const r of ownReplies) push("This council's successful reply", String(r.REFERENCE ?? "") + " - " + String(r.SUBJECT ?? ""), "", String(r.FINAL_TEXT ?? "").slice(0, 220))
  // The council's OWN published FOI disclosure log (s.21 already-published) - a verified own source.
  for (const r of disclosure) push("Exampleton disclosure log", String(r.TOPIC ?? r.REFERENCE_NUMBER ?? ""), "", String(r.RESPONSE_SUMMARY ?? r.REQUEST_SUMMARY ?? ""))
  for (const r of wdtkReal) push("WhatDoTheyKnow (real disclosure)", String(r.REQUEST_TITLE ?? "") + " - " + String(r.AUTHORITY_NAME ?? ""), String(r.PROVENANCE_URL ?? ""), String(r.RESPONSE_BODY ?? ""))
  for (const r of wdtk) push("WhatDoTheyKnow", String(r.REQUEST_TITLE ?? ""), String(r.REQUEST_URL ?? ""), String(r.SNIPPET ?? ""))
  for (const r of gla) push("GLA disclosure log", String(r.TITLE ?? ""), String(r.SOURCE_URL ?? ""), String(r.RESPONSE_TEXT ?? ""))
  for (const r of camden) push("Camden disclosure log", String(r.DOCUMENT_TITLE ?? ""), camdenLinks[String(r.IDENTIFIER ?? "")] ?? "", String(r.DOCUMENT_TEXT ?? ""))
  for (const r of policy) push("Council policy", String(r.DOC_TITLE ?? r.SECTION_REF ?? ""), "", String(r.CONTENT ?? ""))
  // Authoritative statute / Code of Practice grounding the legal basis and any exemption reasoning.
  for (const r of legislation) push("FOIA / EIR legislation", String(r.TITLE ?? "") + " (" + String(r.SECTION_REF ?? "") + ")", "", String(r.SUMMARY ?? ""))
  for (const r of brentwood) push("Brentwood published information", "Brentwood Borough Council", "", String(r.TEXT ?? ""))

  return { q, sources }
}

/**
 * Draft a short suggested answer for a case, grounded in Cortex Search results across
 * the internal corpora, with inline [S1] citations.
 */
export async function suggestAnswer(
  reference: string,
): Promise<AnswerSuggestion | null> {
  const gathered = await gatherGroundedSources(reference)
  if (!gathered) return null
  const { q, sources } = gathered
  const context = sources.map((s) => `[${s.tag}] (${s.origin}) ${s.title}: ${s.snippet}`).join("\n")
  const prompt =
    "You are an FOI officer at a UK council (Exampleton Council) drafting a SUGGESTED answer for an officer to review. " +
    "Sources tagged (This council's records) are Exampleton's OWN internal figures: when they answer the request, DISCLOSE the specific figure and period directly and cite them - do not defer these to internal confirmation. " +
    "Sources tagged (This council's successful reply) are Exampleton's OWN previously-sent replies to similar requests: use them as a guide to tone, structure and phrasing, but ground every factual claim in the records and precedent sources and cite THOSE - do not treat the reused wording itself as a source of facts. " +
    "Use ONLY the sources below; cite them inline as [S1], [S2] etc. " +
    "Never write bracketed placeholders such as '[figure to be provided]' or invent numbers: if the exact figure the request asks for is not in the sources, do not fabricate it - instead confirm the information is held and will be provided, or explain how the request will be handled, grounding that in the precedent and policy sources. Only cite a source if you actually use it. " +
    "Only state that something must be confirmed internally where NO source - including the council's own records - covers it. " +
    "Do not invent facts or figures. Keep it to 120-200 words.\n\n" +
    "REQUEST:\n" + q + "\n\nSOURCES:\n" + (context || "(no internal matches found)") + "\n\nSuggested answer:"

  const t0 = Date.now()
  const rows = await querySnowflakeLongRunning(
    `SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '${escLit(prompt)}') AS R`,
  )
  const answer = String(rows[0]?.R ?? "").trim()
  // A5: meter this draft call (measured tokens + latency, costed via rate card).
  void logAiUsage("draft", reference, "mistral-large2", prompt, answer, Date.now() - t0)
  return { answer, sources, grounded: sources.length > 0 }
}

/**
 * Generate a FULL, ready-to-send FOI/EIR letter that is GROUNDED in the same verified sources
 * as suggestAnswer (real figures, cited), and persist it as the case's live draft together with
 * its source provenance. This unifies the quick-win/Response-studio draft with the grounded
 * pipeline: the letter the officer sends cites real Exampleton figures and carries a source trail.
 */
export interface PinnedPrecedent {
  ref: string
  title: string
  responseText: string
  source: string
}

export async function generateGroundedLetter(
  reference: string,
  type: ResponseType = "DISCLOSURE",
  guidanceNote?: string,
  pinnedPrecedent?: PinnedPrecedent,
): Promise<{ letter: string; sources: AnswerSource[] } | null> {
  const gathered = await gatherGroundedSources(reference)
  if (!gathered) return null
  const { q } = gathered
  // When the officer has adopted a specific precedent, pin it as the S1 source so the
  // letter demonstrably mirrors the previously-successful reply, and re-tag the rest.
  let sources = gathered.sources
  let precedentNote = ""
  if (pinnedPrecedent && pinnedPrecedent.responseText.trim()) {
    const pinned: AnswerSource = {
      tag: "S1",
      origin: "Adopted precedent",
      title: `${pinnedPrecedent.ref}${pinnedPrecedent.title ? ` - ${pinnedPrecedent.title}` : ""}${pinnedPrecedent.source ? ` (${pinnedPrecedent.source})` : ""}`,
      url: "",
      snippet: pinnedPrecedent.responseText.trim().slice(0, 400),
      sourceKind: "OWN_REPLY",
      verified: false,
    }
    sources = [pinned, ...gathered.sources].map((s, i) => ({ ...s, tag: `S${i + 1}` }))
    precedentNote =
      `The officer has adopted precedent ${pinnedPrecedent.ref}, shown as source S1. Answer this request in line with that precedent, mirroring its approach and outcome where the facts match, and cite it. Do not copy any figure from it that is not confirmed in the other sources. `
  }
  const caseRows = await querySnowflake(
    `SELECT CASE_ID, REGIME FROM ${SCHEMA}.FOI_CASE WHERE REFERENCE = '${esc(reference)}' LIMIT 1`,
  )
  if (!caseRows.length) return null
  const caseId = String(caseRows[0].CASE_ID ?? "")
  const regime = String(caseRows[0].REGIME ?? "FOI")
  const context = sources.map((s) => `[${s.tag}] (${s.origin}) ${s.title}: ${s.snippet}`).join("\n")
  const typeGuidance: Record<ResponseType, string> = {
    DISCLOSURE: "This is a FULL DISCLOSURE: release the requested information with the specific figures, engaging no exemptions. ",
    PARTIAL: "This is a PARTIAL disclosure: release what can be released with the figures, then clearly state which part is withheld and under which exemption (for example s.40(2) third-party personal data), with a short public-interest line where the exemption is qualified. ",
    REFUSAL: "This is a REFUSAL: issue a refusal notice under s.17 stating the specific exemption relied on and, if it is qualified, the public-interest balance; or state clearly that the information is not held. ",
    S21_REUSE: "This is an ALREADY-PUBLISHED (s.21) reply: explain that the information is reasonably accessible and already published, and point the requester to exactly where to find it (the source or document named below). Do not re-supply the full dataset. ",
  }
  const prompt =
    `You are an FOI officer at Exampleton Council (a UK local authority) drafting a COMPLETE, ready-to-send ${type} response letter under the ${regime} regime for request ${reference}. ` +
    typeGuidance[type] +
    precedentNote +
    (guidanceNote ? guidanceNote + " " : "") +
    "Sources tagged (This council's records) are Exampleton's OWN internal figures: DISCLOSE the specific figure and period directly and cite them inline as [S1], [S2] etc. " +
    "Sources tagged (This council's successful reply) show how we have answered similar requests before: reuse their tone and structure, but ground every factual claim in the records/precedent sources and cite THOSE. " +
    "Never write bracketed placeholders such as '[figure to be provided]' and never invent numbers: if the exact figure is not in the sources, state the information is held and will be provided rather than fabricating it. Use ONLY the sources below for facts. " +
    "Write a complete letter in UK English, plain text: open with 'Dear Sir or Madam', give the substantive response with the disclosed figures, then a statutory rights paragraph (under s.17 the requester may ask for an internal review and then complain to the Information Commissioner's Office), and close with 'Yours faithfully' and 'Information Governance Team, Exampleton Council'. " +
    "Do not use markdown tables, pipe characters, headings, asterisks or bullet lists: present any figures as flowing prose or, at most, a simple numbered list.\n\n" +
    "REQUEST:\n" + q + "\n\nSOURCES:\n" + (context || "(no internal matches found)") + "\n\nLetter:"
  const t0 = Date.now()
  const rows = await querySnowflakeLongRunning(
    `SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '${escLit(prompt)}') AS R`,
  )
  const letter = String(rows[0]?.R ?? "").trim()
  void logAiUsage("draft", reference, "mistral-large2", prompt, letter, Date.now() - t0)
  if (letter && caseId) {
    // Derive the s.17 badge signals from the letter itself so the DISCLOSURE
    // strip reflects what the draft actually contains.
    const s17InternalReview = /internal review/i.test(letter)
    const s17IcoRoute = /information commissioner|\bICO\b/i.test(letter)
    // An exemption is only "stated" when the response actually withholds under a
    // provision (refusal, partial, or s.21 reuse). A full disclosure never does,
    // even if the letter mentions the word "exempt" in passing.
    const s17ExemptionStated =
      type === "REFUSAL" || type === "PARTIAL" || type === "S21_REUSE"
    // Replace any undispatched draft with this grounded one + its provenance trail.
    await querySnowflake(
      `DELETE FROM ${SCHEMA}.FOI_RESPONSE WHERE CASE_ID = '${esc(caseId)}' AND DISPATCHED_AT IS NULL`,
    )
    await querySnowflake(
      `INSERT INTO ${SCHEMA}.FOI_RESPONSE (CASE_ID, RESPONSE_TYPE, DRAFT_TEXT, S17_EXEMPTION_STATED, S17_INTERNAL_REVIEW_INCLUDED, S17_ICO_ROUTE_INCLUDED, SOURCES)
       SELECT '${esc(caseId)}', '${esc(type)}', '${escLit(letter)}', ${s17ExemptionStated ? "TRUE" : "FALSE"}, ${s17InternalReview ? "TRUE" : "FALSE"}, ${s17IcoRoute ? "TRUE" : "FALSE"}, PARSE_JSON('${escLit(JSON.stringify(sources))}')`,
    )
  }
  return { letter, sources }
}

/**
 * Read a previously precomputed suggested answer for a case (instant render).
 * Returns null when nothing has been precomputed yet, so the panel can fall
 * back to generating one on demand.
 */
export async function getSuggestedAnswer(
  reference: string,
): Promise<AnswerSuggestion | null> {
  const rows = await querySnowflake(
    `SELECT ANSWER_TEXT, SOURCES, GROUNDED
       FROM ${SCHEMA}.FOI_SUGGESTED_ANSWER
      WHERE REFERENCE = '${esc(reference)}'
      LIMIT 1`,
  )
  if (!rows.length) return null
  const answer = String(rows[0].ANSWER_TEXT ?? "").trim()
  if (!answer) return null
  let sources: AnswerSource[] = []
  try {
    const raw = rows[0].SOURCES
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    if (Array.isArray(parsed)) {
      sources = parsed.map((s: Record<string, unknown>) => ({
        tag: String(s.tag ?? ""),
        origin: String(s.origin ?? ""),
        title: String(s.title ?? ""),
        url: String(s.url ?? ""),
        snippet: String(s.snippet ?? ""),
        ...(s.sourceTable ? { sourceTable: String(s.sourceTable) } : {}),
        ...(s.owningService ? { owningService: String(s.owningService) } : {}),
        ...(typeof s.verified === "boolean" ? { verified: s.verified } : {}),
        ...(s.sourceKind ? { sourceKind: String(s.sourceKind) } : {}),
      }))
    }
  } catch { /* leave sources empty */ }
  return { answer, sources, grounded: Boolean(rows[0].GROUNDED) }
}

export interface PrecomputeResult {
  reference: string
  ok: boolean
  grounded?: boolean
  groundedness?: number | null
  coverage?: number | null
  verdict?: string | null
  error?: string
}

/**
 * Precompute + evaluate a suggested answer for one case, then upsert it into
 * FOI_SUGGESTED_ANSWER so the panel can render instantly. The evaluation is an
 * LLM-as-judge pass (groundedness + coverage) — the artifact of our tuning loop.
 */
export async function precomputeSuggestedAnswer(reference: string): Promise<PrecomputeResult> {
  const caseRows = await querySnowflake(
    `SELECT CASE_ID, SUBJECT, REQUEST_TEXT FROM ${SCHEMA}.FOI_CASE WHERE REFERENCE = '${esc(reference)}' LIMIT 1`,
  )
  if (!caseRows.length) return { reference, ok: false, error: "Case not found" }
  const caseId = String(caseRows[0].CASE_ID ?? "")
  const request = `${String(caseRows[0].SUBJECT ?? "")} ${String(caseRows[0].REQUEST_TEXT ?? "")}`.trim().slice(0, 1500)

  const suggestion = await suggestAnswer(reference)
  if (!suggestion || !suggestion.answer) return { reference, ok: false, error: "No suggestion generated" }

  // LLM-as-judge evaluation: groundedness (claims trace to cited sources) and
  // coverage (does it address the request?). Strict JSON out.
  const sourcesForJudge = suggestion.sources.map((s) => `[${s.tag}] (${s.origin}) ${s.title}: ${s.snippet}`).join("\n") || "(no internal matches found)"
  const judgePrompt =
    "You are evaluating a draft FOI answer for a UK local authority. " +
    "Score it on two axes from 0.0 to 1.0: groundedness (every factual claim is traceable to a cited [S#] source; penalise invented facts) " +
    "and coverage (the answer actually addresses what the requester asked). " +
    "Return ONLY strict JSON: {\"groundedness\":0.0,\"coverage\":0.0,\"verdict\":\"PASS|WEAK|FAIL\",\"notes\":\"one short sentence\"}. " +
    "Use PASS when both scores >= 0.7, FAIL when either < 0.4, otherwise WEAK.\n\n" +
    "REQUEST:\n" + request + "\n\nSOURCES:\n" + sourcesForJudge + "\n\nDRAFT ANSWER:\n" + suggestion.answer + "\n\nJSON:"

  let groundedness: number | null = null
  let coverage: number | null = null
  let verdict: string | null = null
  let notes = ""
  let evalRaw = ""
  try {
    const judged = await querySnowflakeLongRunning(
      `SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '${escLit(judgePrompt)}') AS R`,
    )
    const raw = String(judged[0]?.R ?? "")
    evalRaw = raw
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as { groundedness?: number; coverage?: number; verdict?: string; notes?: string }
      const g = Number(parsed.groundedness); if (Number.isFinite(g)) groundedness = Math.max(0, Math.min(1, g))
      const c = Number(parsed.coverage); if (Number.isFinite(c)) coverage = Math.max(0, Math.min(1, c))
      verdict = ["PASS", "WEAK", "FAIL"].includes(String(parsed.verdict)) ? String(parsed.verdict) : null
      notes = String(parsed.notes ?? "").slice(0, 500)
    }
  } catch { /* eval is best-effort; the answer still stores */ }

  const sourcesJson = JSON.stringify(suggestion.sources)
  await querySnowflakeLongRunning(
    `MERGE INTO ${SCHEMA}.FOI_SUGGESTED_ANSWER t
       USING (SELECT '${esc(reference)}' AS REFERENCE) s
       ON t.REFERENCE = s.REFERENCE
     WHEN MATCHED THEN UPDATE SET
       CASE_ID = '${esc(caseId)}',
       ANSWER_TEXT = '${escLit(suggestion.answer)}',
       SOURCES = PARSE_JSON('${escLit(sourcesJson)}'),
       GROUNDED = ${suggestion.grounded ? "TRUE" : "FALSE"},
       MODEL = 'mistral-large2',
       GENERATED_AT = CURRENT_TIMESTAMP(),
       GROUNDEDNESS = ${groundedness == null ? "NULL" : groundedness},
       COVERAGE = ${coverage == null ? "NULL" : coverage},
       EVAL_VERDICT = ${verdict == null ? "NULL" : `'${esc(verdict)}'`},
       EVAL_NOTES = ${notes ? `'${escLit(notes)}'` : "NULL"},
       EVAL_AT = CURRENT_TIMESTAMP()
     WHEN NOT MATCHED THEN INSERT
       (CASE_ID, REFERENCE, ANSWER_TEXT, SOURCES, GROUNDED, MODEL, GENERATED_AT, GROUNDEDNESS, COVERAGE, EVAL_VERDICT, EVAL_NOTES, EVAL_AT)
       VALUES ('${esc(caseId)}', '${esc(reference)}', '${escLit(suggestion.answer)}', PARSE_JSON('${escLit(sourcesJson)}'),
               ${suggestion.grounded ? "TRUE" : "FALSE"}, 'mistral-large2', CURRENT_TIMESTAMP(),
               ${groundedness == null ? "NULL" : groundedness}, ${coverage == null ? "NULL" : coverage},
               ${verdict == null ? "NULL" : `'${esc(verdict)}'`}, ${notes ? `'${escLit(notes)}'` : "NULL"}, CURRENT_TIMESTAMP())`,
  )

  // A6 - record the answer + its evaluation as tamper-evident AI decisions (hashes only, never raw PII).
  const answerInput = `REQUEST:\n${request}\n\nSOURCES:\n${sourcesForJudge}`
  await logAiDecision(reference, "suggested_answer", "mistral-large2", answerInput, suggestion.answer,
    groundedness ?? (suggestion.grounded ? 0.9 : 0.5),
    `FOI answer \u00b7 ${suggestion.sources.length} source${suggestion.sources.length === 1 ? "" : "s"} \u00b7 ${suggestion.grounded ? "grounded" : "ungrounded"}`)
  await logAiDecision(reference, "eval", "mistral-large2", judgePrompt, evalRaw,
    groundedness == null || coverage == null ? null : Math.min(groundedness, coverage),
    `LLM-judge \u00b7 ${verdict ?? "n/a"} \u00b7 g=${groundedness ?? "?"} c=${coverage ?? "?"}`)

  return { reference, ok: true, grounded: suggestion.grounded, groundedness, coverage, verdict }
}

export interface SuggestedAnswerEval {
  n: number
  evaluated: number
  avgGroundedness: number | null
  avgCoverage: number | null
  pctGrounded: number | null
  verdicts: { verdict: string; n: number }[]
}

/** Aggregate suggested-answer quality for the tuning/learning page. */
export async function getSuggestedAnswerEval(): Promise<SuggestedAnswerEval> {
  const [agg, byVerdict] = await Promise.all([
    querySnowflake(
      `SELECT COUNT(*) AS N,
              COUNT(GROUNDEDNESS) AS EVALUATED,
              AVG(GROUNDEDNESS) AS AVG_G,
              AVG(COVERAGE) AS AVG_C,
              AVG(IFF(GROUNDED, 1, 0)) AS PCT_GROUNDED
         FROM ${SCHEMA}.FOI_SUGGESTED_ANSWER`,
    ).catch(() => []),
    querySnowflake(
      `SELECT EVAL_VERDICT AS V, COUNT(*) AS N
         FROM ${SCHEMA}.FOI_SUGGESTED_ANSWER
        WHERE EVAL_VERDICT IS NOT NULL
        GROUP BY EVAL_VERDICT`,
    ).catch(() => []),
  ])
  const a = agg[0] ?? {}
  return {
    n: n(a.N),
    evaluated: n(a.EVALUATED),
    avgGroundedness: a.AVG_G == null ? null : Number(a.AVG_G),
    avgCoverage: a.AVG_C == null ? null : Number(a.AVG_C),
    pctGrounded: a.PCT_GROUNDED == null ? null : Number(a.PCT_GROUNDED),
    verdicts: byVerdict.map((r) => ({ verdict: String(r.V ?? ""), n: n(r.N) })),
  }
}

// ---------------------------------------------------------------------------
// Published information (s.21 "reasonably accessible by other means"). A member
// of the public asks a question; we search the council's published decisions
// (committee/cabinet reports + policy) via Cortex Search and draft a pointer to
// where it is already published — deflecting an FOI request under s.21.
// ---------------------------------------------------------------------------

export interface PublishedSource {
  tag: string
  docType: string
  title: string
  sectionRef: string
  snippet: string
}

export interface PublishedAnswer {
  answer: string
  sources: PublishedSource[]
  grounded: boolean
}

export interface PublishedTopic {
  title: string
  sectionRef: string
  category: string
}

/** Recent published committee/cabinet decisions — used as example prompts. */
export async function getPublishedTopics(limit = 8): Promise<PublishedTopic[]> {
  const rows = await querySnowflake(
    `SELECT DOC_TITLE, SECTION_REF, CATEGORY
       FROM ${SCHEMA}.COUNCIL_POLICY_DOCS
      WHERE DOC_TYPE = 'COMMITTEE_REPORT'
      ORDER BY EFFECTIVE_DATE DESC NULLS LAST
      LIMIT ${Math.max(1, Math.min(20, limit))}`,
  )
  return rows.map((r) => ({
    title: String(r.DOC_TITLE ?? ""),
    sectionRef: String(r.SECTION_REF ?? ""),
    category: String(r.CATEGORY ?? ""),
  }))
}

/**
 * Answer a public question from already-published council information. Searches
 * the policy/decision corpus with Cortex Search, then drafts a s.21-style
 * "this is already published, here is what was agreed and where to find it"
 * reply with inline [S1] citations.
 */
export async function searchPublished(query: string): Promise<PublishedAnswer> {
  const q = query.trim().slice(0, 1000)
  if (!q) return { answer: "", sources: [], grounded: false }

  const results = await cortexSearch(
    "COUNCIL_POLICY_SEARCH",
    q,
    ["DOC_TITLE", "DOC_TYPE", "SECTION_REF", "CONTENT"],
    5,
  )

  const sources: PublishedSource[] = []
  for (const r of results) {
    const snippet = String(r.CONTENT ?? "").trim()
    if (!snippet) continue
    sources.push({
      tag: `S${sources.length + 1}`,
      docType: String(r.DOC_TYPE ?? ""),
      title: String(r.DOC_TITLE ?? r.SECTION_REF ?? "Published document"),
      sectionRef: String(r.SECTION_REF ?? ""),
      snippet: snippet.slice(0, 500),
    })
  }

  if (!sources.length) {
    return {
      answer:
        "I could not find this in the council's published decisions or policies. It may not already be published, so a formal request may be needed.",
      sources: [],
      grounded: false,
    }
  }

  const context = sources
    .map((s) => `[${s.tag}] (${s.docType} ${s.sectionRef}) ${s.title}: ${s.snippet}`)
    .join("\n")
  const prompt =
    "You are an FOI officer at a UK council. A member of the public asked the QUESTION below. " +
    "Apply section 21 of the Freedom of Information Act (information reasonably accessible by other means). " +
    "Using ONLY the published SOURCES, reply plainly: state whether the information is already published, " +
    "summarise what was agreed or what it says, and tell them where to find it. Cite sources inline as [S1], [S2]. " +
    "If the sources do not answer the question, say it may not already be published and a request may be needed. " +
    "Do not invent facts, figures or dates. Keep it to 100-180 words.\n\n" +
    "QUESTION:\n" + q + "\n\nSOURCES:\n" + context + "\n\nReply:"

  const rows = await querySnowflakeLongRunning(
    `SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '${escLit(prompt)}') AS R`,
  )
  return { answer: String(rows[0]?.R ?? "").trim(), sources, grounded: true }
}

// ---------------------------------------------------------------------------
// Kanban board — the 17 lifecycle stages grouped into the 5-step FOIA process
// (+ a Challenge column for s.50 review). The precise stage shows on each card.
// Ported from the original board (05_app/app_pages/cases.py).
// ---------------------------------------------------------------------------

// PHASES / STAGE_TO_PHASE / PHASE_FIRST_STAGE live in the pure, client-safe
// lib/lifecycle.ts (no server deps). Re-exported here so existing server-side
// importers (e.g. app/cases/page.tsx) keep working unchanged.
import { PHASES, STAGE_TO_PHASE, PHASE_FIRST_STAGE } from "@/lib/lifecycle"
export { PHASES, STAGE_TO_PHASE, PHASE_FIRST_STAGE }

export interface BoardCase {
  reference: string
  subject: string
  regime: string
  rag: string
  wdRemaining: number | null
  currentStage: string
  stageName: string
  phaseId: string
  isVexatious: boolean
  priorityScore: number | null
  priorityBand: string
  complexity: number | null
  complexityFactors: string[]
  sentiment: number | null
  sentimentRationale: string
  precedentPct: number | null
  ownerTitle: string
}

/**
 * Open, non-synthetic cases for the Kanban board, ordered by priority within
 * each phase (triage drives the queue). Requester identity is never selected.
 */
export async function getBoardCases(f: CaseFilters = {}): Promise<BoardCase[]> {
  const where: string[] = ["v.STATUS = 'OPEN'", "NOT COALESCE(v.IS_SYNTHETIC, FALSE)"]
  if (f.regime) where.push(`v.REGIME = '${esc(f.regime.toUpperCase())}'`)
  if (f.risk === "atrisk") where.push("(v.RAG = 'RED' OR v.WD_REMAINING < 0)")
  if (f.risk === "overdue") where.push("v.WD_REMAINING < 0")
  const rows = await querySnowflake(`
    SELECT v.REFERENCE, v.SUBJECT, v.REGIME, v.RAG, v.WD_REMAINING, v.CURRENT_STAGE, v.STAGE_NAME,
           v.IS_VEXATIOUS, v.PRIORITY_SCORE, v.PRIORITY_BAND, v.COMPLEXITY_RANK, v.SENTIMENT_SCORE,
           ofc.PERSONA AS OWNER_TITLE,
           tr.REASONING_JSON:complexity_factors AS FACTORS,
           tr.REASONING_JSON:sentiment_rationale::string AS RATIONALE,
           pm.SIMILARITY_PCT AS PRECEDENT_PCT
    FROM ${SCHEMA}.V_CASE v
    LEFT JOIN ${SCHEMA}.FOI_OFFICER ofc ON ofc.NAME = v.ASSIGNED_OFFICER
    LEFT JOIN ${SCHEMA}.FOI_TRIAGE tr ON v.CASE_ID = tr.CASE_ID
    LEFT JOIN ${SCHEMA}.FOI_PRECEDENT_MATCH pm ON pm.REFERENCE = v.REFERENCE
    WHERE ${where.join(" AND ")}
    ORDER BY v.PRIORITY_SCORE DESC NULLS LAST, v.WD_REMAINING ASC NULLS LAST
  `)
  return rows.map((r) => {
    const stage = String(r.CURRENT_STAGE ?? "")
    return {
      reference: String(r.REFERENCE ?? ""),
      subject: String(r.SUBJECT ?? "Untitled request"),
      regime: String(r.REGIME ?? ""),
      rag: String(r.RAG ?? ""),
      wdRemaining: r.WD_REMAINING == null ? null : n(r.WD_REMAINING),
      currentStage: stage,
      stageName: String(r.STAGE_NAME ?? stage),
      phaseId: STAGE_TO_PHASE[stage] ?? "Receipt",
      isVexatious: r.IS_VEXATIOUS === true,
      priorityScore: r.PRIORITY_SCORE == null ? null : Number(r.PRIORITY_SCORE),
      priorityBand: String(r.PRIORITY_BAND ?? ""),
      complexity: r.COMPLEXITY_RANK == null ? null : Number(r.COMPLEXITY_RANK),
      complexityFactors: asStringArray(r.FACTORS),
      sentiment: r.SENTIMENT_SCORE == null ? null : Number(r.SENTIMENT_SCORE),
      sentimentRationale: String(r.RATIONALE ?? ""),
      precedentPct: r.PRECEDENT_PCT == null ? null : Number(r.PRECEDENT_PCT),
      ownerTitle: String(r.OWNER_TITLE ?? "Case officer"),
    }
  })
}

/**
 * Advance a case (by public reference) to the first stage of a target phase via
 * SP_ADVANCE_STAGE. Returns the new stage code/name, or null if no move was made
 * (case not found, or already in that phase). Used by the board's write API.
 */
export async function advanceCaseToPhase(reference: string, toPhase: string): Promise<{ stage: string; stageName: string } | null> {
  const target = PHASE_FIRST_STAGE[toPhase]
  if (!target) return null
  const rows = await querySnowflake(`
    SELECT CASE_ID, CURRENT_STAGE
    FROM ${SCHEMA}.FOI_CASE
    WHERE REFERENCE = '${esc(reference)}' AND NOT COALESCE(IS_SYNTHETIC, FALSE)
    LIMIT 1
  `)
  if (!rows.length) return null
  const caseId = String(rows[0].CASE_ID ?? "")
  const current = String(rows[0].CURRENT_STAGE ?? "")
  if (!caseId || current === target) return null

  await querySnowflake(
    `CALL ${SCHEMA}.SP_ADVANCE_STAGE('${esc(caseId)}', '${esc(target)}', 'HUMAN', 'FOI Officer', 'Moved on board (drag)')`,
  )
  const nameRows = await querySnowflake(`
    SELECT STAGE_NAME FROM ${SCHEMA}.LIFECYCLE_STAGE WHERE STAGE_CODE = '${esc(target)}' LIMIT 1
  `)
  return { stage: target, stageName: String(nameRows[0]?.STAGE_NAME ?? target) }
}

export interface LifecycleStage {
  code: string
  name: string
  order: number
}

/** The 17 lifecycle stages, ordered — drives the case-detail stage dropdown. */
export async function getLifecycleStages(): Promise<LifecycleStage[]> {
  const rows = await querySnowflake(`
    SELECT STAGE_CODE, STAGE_NAME, STAGE_ORDER
    FROM ${SCHEMA}.LIFECYCLE_STAGE
    ORDER BY STAGE_ORDER
  `)
  return rows.map((r) => ({
    code: String(r.STAGE_CODE ?? ""),
    name: String(r.STAGE_NAME ?? ""),
    order: n(r.STAGE_ORDER),
  }))
}

/**
 * Set a case (by public reference) to an explicit lifecycle stage via
 * SP_ADVANCE_STAGE. Unlike advanceCaseToPhase this targets a specific stage
 * code chosen by an officer on the case page (can move forward or back).
 * Returns the new stage code/name, or null if invalid / no change.
 */
export async function setCaseStage(reference: string, toStage: string): Promise<{ stage: string; stageName: string } | null> {
  const stageRows = await querySnowflake(`
    SELECT STAGE_NAME FROM ${SCHEMA}.LIFECYCLE_STAGE WHERE STAGE_CODE = '${esc(toStage)}' LIMIT 1
  `)
  if (!stageRows.length) return null // unknown stage code
  const stageName = String(stageRows[0].STAGE_NAME ?? toStage)

  const caseRows = await querySnowflake(`
    SELECT CASE_ID, CURRENT_STAGE
    FROM ${SCHEMA}.FOI_CASE
    WHERE REFERENCE = '${esc(reference)}' AND NOT COALESCE(IS_SYNTHETIC, FALSE)
    LIMIT 1
  `)
  if (!caseRows.length) return null
  const caseId = String(caseRows[0].CASE_ID ?? "")
  const current = String(caseRows[0].CURRENT_STAGE ?? "")
  if (!caseId || current === toStage) return null // no-op

  await querySnowflake(
    `CALL ${SCHEMA}.SP_ADVANCE_STAGE('${esc(caseId)}', '${esc(toStage)}', 'HUMAN', 'FOI Officer', 'Stage set via case page')`,
  )
  return { stage: toStage, stageName }
}

// ---------------------------------------------------------------------------
// AI triage reasoning — the stored "why" behind a case's classification,
// complexity and sentiment. Read from FOI_TRIAGE (TRIAGE_JSON computed at
// intake by Cortex COMPLETE + REASONING_JSON enriched with concrete drivers).
// Shared by the case-detail TriagePanel and (later) the Email Intake demo.
// ---------------------------------------------------------------------------

export interface CaseTriage {
  classification: string
  priority: string
  complexityScore: number | null
  complexityFactors: string[]
  sentimentScore: number | null
  sentimentRationale: string
  departments: string[]
  estimatedHours: number | null
  isVexatious: boolean
  summary: string
  model: string
  confidence: number | null
  computedAt: string | null
  s21MatchRef: string
  scope: { dateRange: string; departments: string; documents: string } | null
}

const asStringArray = (v: unknown): string[] => {
  let val = v
  if (typeof val === "string") {
    const str = val
    try { val = JSON.parse(str) } catch { return str.trim() ? [str] : [] }
  }
  return Array.isArray(val) ? val.map((x) => String(x)).filter(Boolean) : []
}

export async function getCaseTriage(caseId: string): Promise<CaseTriage | null> {
  const rows = await querySnowflake(`
    SELECT
      t.TRIAGE_JSON:category::string        AS CATEGORY,
      t.TRIAGE_JSON:priority::string        AS PRIORITY,
      COALESCE(t.COMPLEXITY_RANK, t.TRIAGE_JSON:complexity_score::float) AS COMPLEXITY,
      t.REASONING_JSON:complexity_factors   AS FACTORS,
      c.SENTIMENT_SCORE                     AS SENTIMENT,
      t.REASONING_JSON:sentiment_rationale::string AS RATIONALE,
      t.TRIAGE_JSON:suggested_departments   AS DEPARTMENTS,
      t.TRIAGE_JSON:estimated_hours::float  AS HOURS,
      t.TRIAGE_JSON:is_vexatious::boolean   AS VEXATIOUS,
      t.TRIAGE_JSON:summary::string         AS SUMMARY,
      t.MODEL                               AS MODEL,
      t.CONFIDENCE                          AS CONFIDENCE,
      t.COMPUTED_AT                         AS COMPUTED_AT,
      t.S21_MATCH_REF                       AS S21_REF,
      t.TRIAGE_JSON:scope                   AS SCOPE
    FROM ${SCHEMA}.FOI_TRIAGE t
    JOIN ${SCHEMA}.FOI_CASE c ON t.CASE_ID = c.CASE_ID
    WHERE t.CASE_ID = '${esc(caseId)}'
    LIMIT 1
  `)
  if (!rows.length) return null
  const r = rows[0]
  return {
    classification: String(r.CATEGORY ?? ""),
    priority: String(r.PRIORITY ?? ""),
    complexityScore: r.COMPLEXITY == null ? null : Number(r.COMPLEXITY),
    complexityFactors: asStringArray(r.FACTORS),
    sentimentScore: r.SENTIMENT == null ? null : Number(r.SENTIMENT),
    sentimentRationale: String(r.RATIONALE ?? ""),
    departments: asStringArray(r.DEPARTMENTS),
    estimatedHours: r.HOURS == null ? null : Number(r.HOURS),
    isVexatious: r.VEXATIOUS === true,
    summary: String(r.SUMMARY ?? ""),
    model: String(r.MODEL ?? ""),
    confidence: r.CONFIDENCE == null ? null : Number(r.CONFIDENCE),
    computedAt: r.COMPUTED_AT == null ? null : String(r.COMPUTED_AT),
    s21MatchRef: String(r.S21_REF ?? ""),
    scope: (() => {
      try {
        const sc = typeof r.SCOPE === "string" ? JSON.parse(r.SCOPE) : r.SCOPE
        if (!sc) return null
        const clean = (v: unknown) => { const s = String(v ?? "").trim(); return s && s.toLowerCase() !== "none" ? s : "" }
        return { dateRange: clean(sc.date_range), departments: clean(sc.departments), documents: clean(sc.documents) }
      } catch { return null }
    })(),
  }
}

// ---------------------------------------------------------------------------
// Precedent match — a new request matched against a previously-answered request
// that drew no complaint/review. Pre-computed into FOI_PRECEDENT_MATCH; surfaced
// as a HITL signal ("use this precedent / mark reviewed") on board + detail.
// ---------------------------------------------------------------------------

export interface PrecedentMatch {
  similarityPct: number | null
  source: string
  ref: string
  title: string
  responseText: string
  url: string
  cleanOutcome: string
  used: boolean
  reviewedBy: string
  /** TRUE = the matched precedent is a synthetic/illustrative comparator, not a real authority disclosure. */
  isSynthetic: boolean
}

export async function getPrecedentMatch(reference: string): Promise<PrecedentMatch | null> {
  const rows = await querySnowflake(`
    SELECT SIMILARITY_PCT, SOURCE, REF, TITLE, RESPONSE_TEXT, URL, CLEAN_OUTCOME, USED, REVIEWED_BY, IS_SYNTHETIC
    FROM ${SCHEMA}.FOI_PRECEDENT_MATCH
    WHERE REFERENCE = '${esc(reference)}'
    ORDER BY SIMILARITY_PCT DESC NULLS LAST
    LIMIT 1
  `)
  if (!rows.length) return null
  const r = rows[0]
  return {
    similarityPct: r.SIMILARITY_PCT == null ? null : Number(r.SIMILARITY_PCT),
    source: String(r.SOURCE ?? ""),
    ref: String(r.REF ?? ""),
    title: String(r.TITLE ?? ""),
    responseText: String(r.RESPONSE_TEXT ?? ""),
    url: String(r.URL ?? ""),
    cleanOutcome: String(r.CLEAN_OUTCOME ?? ""),
    used: r.USED === true,
    reviewedBy: String(r.REVIEWED_BY ?? ""),
    isSynthetic: r.IS_SYNTHETIC === true,
  }
}

/**
 * HITL action on a precedent: 'use' (officer adopts it) or 'review' (officer
 * has checked it). Updates FOI_PRECEDENT_MATCH and logs a FOI_CASE_EVENT.
 * Returns the new {used, reviewedBy} state or null if no match exists.
 */
export async function markPrecedent(reference: string, action: "use" | "review"): Promise<{ used: boolean; reviewedBy: string; advancedTo: string | null; canDraftFromPrecedent: boolean; hasExistingDraft: boolean; suggestedType: ResponseType } | null> {
  const caseRows = await querySnowflake(`
    SELECT c.CASE_ID, c.CURRENT_STAGE, cs.STAGE_ORDER AS CUR_ORDER,
           ds.STAGE_ORDER AS DRAFT_ORDER, ds.STAGE_NAME AS DRAFT_NAME
    FROM ${SCHEMA}.FOI_CASE c
    LEFT JOIN ${SCHEMA}.LIFECYCLE_STAGE cs ON cs.STAGE_CODE = c.CURRENT_STAGE
    CROSS JOIN ${SCHEMA}.LIFECYCLE_STAGE ds
    WHERE c.REFERENCE = '${esc(reference)}' AND ds.STAGE_CODE = 'DRAFTING'
    LIMIT 1
  `)
  if (!caseRows.length) return null
  const caseId = String(caseRows[0].CASE_ID ?? "")

  const exists = await querySnowflake(`
    SELECT 1 FROM ${SCHEMA}.FOI_PRECEDENT_MATCH WHERE REFERENCE = '${esc(reference)}' LIMIT 1
  `)
  if (!exists.length) return null

  const officer = "FOI Officer"
  if (action === "use") {
    await querySnowflake(`
      UPDATE ${SCHEMA}.FOI_PRECEDENT_MATCH
      SET USED = TRUE, REVIEWED_BY = '${esc(officer)}', REVIEWED_AT = CURRENT_TIMESTAMP()
      WHERE REFERENCE = '${esc(reference)}'
    `)
  } else {
    await querySnowflake(`
      UPDATE ${SCHEMA}.FOI_PRECEDENT_MATCH
      SET REVIEWED_BY = '${esc(officer)}', REVIEWED_AT = CURRENT_TIMESTAMP()
      WHERE REFERENCE = '${esc(reference)}'
    `)
  }

  const note = action === "use" ? "Precedent adopted for drafting" : "Precedent reviewed"
  await querySnowflake(`
    INSERT INTO ${SCHEMA}.FOI_CASE_EVENT (CASE_ID, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
    SELECT '${esc(caseId)}', 'HUMAN', '${esc(officer)}', 'PRECEDENT', '${esc(note)}'
  `)

  // Adopting a clean precedent short-cuts the case to Response drafting — but only
  // advance forwards (never push a later-stage case back to drafting).
  let advancedTo: string | null = null
  if (action === "use") {
    const curOrder = caseRows[0].CUR_ORDER == null ? 0 : Number(caseRows[0].CUR_ORDER)
    const draftOrder = Number(caseRows[0].DRAFT_ORDER)
    const draftName = String(caseRows[0].DRAFT_NAME ?? "Response drafting")
    if (Number.isFinite(draftOrder) && curOrder < draftOrder) {
      await querySnowflake(
        `CALL ${SCHEMA}.SP_ADVANCE_STAGE('${esc(caseId)}', 'DRAFTING', 'HUMAN', '${esc(officer)}', 'Advanced to Response drafting after adopting precedent')`,
      )
      advancedTo = draftName
    }
  }

  // Tell the client whether adopting this precedent can seed a grounded draft. We never
  // overwrite an existing undispatched draft here (the officer regenerates explicitly from
  // the studio); we only offer to draft from the precedent when none exists yet.
  let canDraftFromPrecedent = false
  let hasExistingDraft = false
  let suggestedType: ResponseType = "DISCLOSURE"
  if (action === "use") {
    const rows = await querySnowflake(`
      SELECT
        (SELECT COUNT(*) FROM ${SCHEMA}.FOI_RESPONSE WHERE CASE_ID = '${esc(caseId)}' AND DISPATCHED_AT IS NULL) AS OPEN_DRAFTS,
        (SELECT COUNT(*) FROM ${SCHEMA}.FOI_PRECEDENT_MATCH WHERE REFERENCE = '${esc(reference)}' AND RESPONSE_TEXT IS NOT NULL AND LENGTH(RESPONSE_TEXT) > 0) AS HAS_PRECEDENT_TEXT,
        (SELECT STATUS FROM ${SCHEMA}.FOI_CASE WHERE CASE_ID = '${esc(caseId)}') AS STATUS
    `)
    const openDrafts = Number(rows[0]?.OPEN_DRAFTS ?? 0)
    const hasPrecedentText = Number(rows[0]?.HAS_PRECEDENT_TEXT ?? 0) > 0
    const isOpen = String(rows[0]?.STATUS ?? "").toUpperCase() !== "CLOSED"
    hasExistingDraft = openDrafts > 0
    canDraftFromPrecedent = isOpen && hasPrecedentText && openDrafts === 0
    if (canDraftFromPrecedent) suggestedType = (await suggestedResponseType(reference)).type
  }

  return { used: action === "use", reviewedBy: officer, advancedTo, canDraftFromPrecedent, hasExistingDraft, suggestedType }
}

// ---------------------------------------------------------------------------
// SAR third-party redaction — for a Subject Access Request the requester gets
// their OWN personal data, but third-party personal data must be removed
// (s.40 / DPA 2018). Cortex AI_REDACT detects the personal data; a human
// verifies each item (keep the requester's own, redact third parties) before
// release. Reads SAR_SOURCE_DOC, writes SAR_REDACTION + an audit event.
// ---------------------------------------------------------------------------

export interface SarDoc {
  docId: string
  title: string
  text: string
  spansTotal: number | null
  spansRedacted: number | null
  releasedAt: string | null
}

export interface RedactSpan {
  category: string
  text: string
  prior?: "KEEP" | "REDACT" | null // most-recent officer decision for this value (learning)
}

/** Internal documents attached to a SAR case, with any latest released state. */
export async function getSarDocs(reference: string): Promise<SarDoc[]> {
  const rows = await querySnowflake(`
    SELECT d.DOC_ID, d.DOC_TITLE, d.DOC_TEXT,
           r.SPANS_TOTAL, r.SPANS_REDACTED, r.RELEASED_AT
    FROM ${SCHEMA}.SAR_SOURCE_DOC d
    JOIN ${SCHEMA}.FOI_CASE c ON c.CASE_ID = d.CASE_ID
    LEFT JOIN ${SCHEMA}.SAR_REDACTION r ON r.DOC_ID = d.DOC_ID
      AND r.RELEASED_AT = (
        SELECT MAX(r2.RELEASED_AT) FROM ${SCHEMA}.SAR_REDACTION r2 WHERE r2.DOC_ID = d.DOC_ID
      )
    WHERE c.REFERENCE = '${esc(reference)}'
    ORDER BY d.DOC_TITLE
  `)
  return rows.map((r) => ({
    docId: String(r.DOC_ID ?? ""),
    title: String(r.DOC_TITLE ?? "Untitled document"),
    text: String(r.DOC_TEXT ?? ""),
    spansTotal: r.SPANS_TOTAL == null ? null : Number(r.SPANS_TOTAL),
    spansRedacted: r.SPANS_REDACTED == null ? null : Number(r.SPANS_REDACTED),
    releasedAt: r.RELEASED_AT == null ? null : String(r.RELEASED_AT),
  }))
}

/** Detect personal data in a SAR doc with Cortex AI_REDACT (no write). */
export async function detectSarPii(docId: string): Promise<RedactSpan[]> {
  const rows = await querySnowflake(`
    SELECT AI_REDACT(input => DOC_TEXT, return_error_details => FALSE, mode => 'detect') AS S
    FROM ${SCHEMA}.SAR_SOURCE_DOC WHERE DOC_ID = '${esc(docId)}' LIMIT 1
  `)
  if (!rows.length) return []
  const raw = rows[0].S
  let obj: { spans?: unknown }
  try {
    obj = (typeof raw === "string" ? JSON.parse(raw) : raw) ?? {}
  } catch {
    return []
  }
  const spans = Array.isArray(obj.spans) ? obj.spans : []
  const priorMap = await getRedactionPriorMap()
  return spans
    .map((sp) => {
      const text = String((sp as Record<string, unknown>)?.text ?? "")
      return {
        category: String((sp as Record<string, unknown>)?.category ?? "PII"),
        text,
        prior: priorMap.get(text.trim().toLowerCase()) ?? null,
      }
    })
    .filter((s) => s.text)
}

/**
 * Release a SAR document bundle: the human-verified redacted text, with counts.
 * Replaces any prior release for the doc and logs a human DECISION event.
 */
export async function releaseSarDoc(input: {
  reference: string
  docId: string
  releasedText: string
  spansTotal: number
  spansRedacted: number
  decisions?: { category: string; value: string; action: "KEEP" | "REDACT" }[]
}): Promise<{ ok: boolean }> {
  const officer = "SAR Officer"
  const caseRows = await querySnowflake(
    `SELECT CASE_ID FROM ${SCHEMA}.FOI_CASE WHERE REFERENCE = '${esc(input.reference)}' LIMIT 1`,
  )
  if (!caseRows.length) return { ok: false }
  const caseId = String(caseRows[0].CASE_ID ?? "")

  const docRows = await querySnowflake(
    `SELECT DOC_TITLE FROM ${SCHEMA}.SAR_SOURCE_DOC WHERE DOC_ID = '${esc(input.docId)}' AND CASE_ID = '${esc(caseId)}' LIMIT 1`,
  )
  if (!docRows.length) return { ok: false } // doc not on this case
  const docTitle = String(docRows[0].DOC_TITLE ?? "document")

  await querySnowflake(`DELETE FROM ${SCHEMA}.SAR_REDACTION WHERE DOC_ID = '${esc(input.docId)}'`)
  await querySnowflake(`
    INSERT INTO ${SCHEMA}.SAR_REDACTION (CASE_ID, DOC_ID, RELEASED_TEXT, SPANS_TOTAL, SPANS_REDACTED, RELEASED_BY)
    SELECT '${esc(caseId)}', '${esc(input.docId)}', '${escLit(input.releasedText)}',
           ${Math.max(0, Math.trunc(input.spansTotal))}, ${Math.max(0, Math.trunc(input.spansRedacted))}, '${esc(officer)}'
  `)
  const note =
    `SAR redaction released for "${docTitle}": ${Math.max(0, Math.trunc(input.spansRedacted))} of ` +
    `${Math.max(0, Math.trunc(input.spansTotal))} third-party items redacted (human-verified)`
  await querySnowflake(`
    INSERT INTO ${SCHEMA}.FOI_CASE_EVENT (CASE_ID, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
    SELECT '${esc(caseId)}', 'HUMAN', '${esc(officer)}', 'DECISION', '${escLit(note)}'
  `)

  // Feed the shared learning flywheel so the Studio and case panel learn together.
  const decisions = (input.decisions ?? []).filter((d) => d.value && (d.action === "KEEP" || d.action === "REDACT"))
  if (decisions.length) {
    await querySnowflake(
      `DELETE FROM ${SCHEMA}.SAR_REDACTION_DECISION WHERE SOURCE = 'case' AND DOC_KEY = '${esc(input.docId)}'`,
    )
    const values = decisions
      .map(
        (d) =>
          `('case', '${esc(input.docId)}', '${esc(d.category)}', '${escLit(d.value.trim().toLowerCase())}', '${d.action}', NULL, '${esc(officer)}')`,
      )
      .join(", ")
    await querySnowflake(
      `INSERT INTO ${SCHEMA}.SAR_REDACTION_DECISION (SOURCE, DOC_KEY, CATEGORY, VALUE_NORM, ACTION, CONFIDENCE, DECIDED_BY) VALUES ${values}`,
    )
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// SAR Redaction Studio — a real council case-file PDF (synthetic PII) held on
// an internal stage is read with AI_PARSE_DOCUMENT, then AI_EXTRACT performs
// SELECTIVE third-party detection (keep the requester's own data, redact
// everyone else's) with GA confidence scores. Powers /redaction.
// AI_REDACT is deliberately NOT used here: it masks ALL personal data
// indiscriminately, which would black out the requester's own data too — the
// opposite of what a Subject Access Request requires.
// ---------------------------------------------------------------------------

const SAR_STAGE = `@${SCHEMA}.SAR_STAGE`
const SAR_DEMO_FILE = "sar_casefile.pdf"

export interface RedactionDemoDoc {
  file: string
  title: string
  presignedUrl: string
  requesterName: string
  requesterPhone: string
  claimRef: string
}

export interface RedactionFinding {
  category: string // NAME | PHONE | EMAIL | ADDRESS
  value: string
  confidence: number | null // 0..1 aggregate score for the category
  located: boolean // whether the value was found in the parsed text
  prior: "KEEP" | "REDACT" | null // most-recent officer decision for this value (learning)
}

export interface RedactionDemoResult {
  parsedText: string
  redactedText: string
  findings: RedactionFinding[]
  kept: string[] // requester's own identifiers deliberately preserved
  redactedCount: number
  requesterName: string
  docKey: string // stable key for persisting/learning decisions on this doc
  learnedCount: number // how many findings carried a prior officer decision
  sql: { parse: string; extract: string }
}

/** Requester identity + a presigned URL for the staged case-file PDF. */
export async function getRedactionDemoDoc(): Promise<RedactionDemoDoc> {
  const subj = await querySnowflake(
    `SELECT REQUESTER_NAME, REQUESTER_PHONE, CLAIM_REFERENCE FROM ${SCHEMA}.SAR_CASE_SUBJECT LIMIT 1`,
  )
  const s = subj[0] ?? {}
  const urlRows = await querySnowflake(
    `SELECT GET_PRESIGNED_URL('${SAR_STAGE}', '${escLit(SAR_DEMO_FILE)}', 3600) AS U`,
  )
  return {
    file: SAR_DEMO_FILE,
    title: "Housing Benefit — Case-file note",
    presignedUrl: String(urlRows[0]?.U ?? ""),
    requesterName: String(s.REQUESTER_NAME ?? ""),
    requesterPhone: String(s.REQUESTER_PHONE ?? ""),
    claimRef: String(s.CLAIM_REFERENCE ?? ""),
  }
}

const REDACT_CATEGORIES: Record<string, string> = {
  third_party_names: "NAME",
  third_party_phones: "PHONE",
  third_party_emails: "EMAIL",
  third_party_addresses: "ADDRESS",
}

// The council's own PUBLISHED organisational numbers (e.g. the main switchboard).
// These are not personal data, so they must NOT be redacted as "third-party" PII
// even if AI_EXTRACT surfaces them. Matched on digits-only so spacing is ignored.
const SAR_ORG_PHONES = new Set(["01179000000"])
const digitsOnly = (s: string) => s.replace(/\D/g, "")
const isOrgPhone = (s: string) => SAR_ORG_PHONES.has(digitsOnly(s))

// Generic role/team mailboxes are organisational, not third-party PERSONAL
// data, so they must NOT be redacted under s.40 even if AI_EXTRACT surfaces
// them. Matched on the local-part (before the @) so the domain is ignored.
const SAR_ORG_MAILBOXES = new Set([
  "benefits", "info", "contact", "enquiries", "revenues", "housing", "customerservices", "foi", "dpo",
])
const isOrgMailbox = (s: string) => SAR_ORG_MAILBOXES.has(s.trim().toLowerCase().split("@")[0] ?? "")

/** Most-recent officer keep/redact decision per detected value — the shared
 *  learning flywheel across the Redaction Studio and the case-level SAR panel. */
async function getRedactionPriorMap(): Promise<Map<string, "KEEP" | "REDACT">> {
  const rows = await querySnowflake(`
    SELECT VALUE_NORM, ACTION FROM ${SCHEMA}.SAR_REDACTION_DECISION
    QUALIFY ROW_NUMBER() OVER (PARTITION BY VALUE_NORM ORDER BY DECIDED_AT DESC) = 1
  `)
  const m = new Map<string, "KEEP" | "REDACT">()
  for (const r of rows) {
    const a = String(r.ACTION ?? "")
    if (a === "KEEP" || a === "REDACT") m.set(String(r.VALUE_NORM ?? ""), a)
  }
  return m
}

/** Escape a string for use inside a RegExp. */
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&pound;/g, "\u00a3")
    .replace(/&nbsp;/g, " ")
const normWs = (s: string) => decodeEntities(s).replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ")

/**
 * Read the staged case-file PDF and run selective third-party extraction.
 * Returns parsed text, per-entity findings with confidence, and a redacted
 * document where third-party PII is blacked out but the requester's own data
 * (name, phone, claim ref) is preserved.
 */
export async function runRedactionDemo(): Promise<RedactionDemoResult> {
  const subj = await querySnowflake(
    `SELECT REQUESTER_NAME, REQUESTER_PHONE, CLAIM_REFERENCE FROM ${SCHEMA}.SAR_CASE_SUBJECT LIMIT 1`,
  )
  const s = subj[0] ?? {}
  const requesterName = String(s.REQUESTER_NAME ?? "the requester")
  const requesterPhone = String(s.REQUESTER_PHONE ?? "")
  const claimRef = String(s.CLAIM_REFERENCE ?? "")

  const fileRef = `TO_FILE('${SAR_STAGE}', '${escLit(SAR_DEMO_FILE)}')`
  const parseSql =
    `SELECT TO_VARCHAR(\n` +
    `  AI_PARSE_DOCUMENT(${fileRef}, {'mode': 'LAYOUT'}):content\n` +
    `) AS PARSED`
  const extractSql =
    `SELECT AI_EXTRACT(\n` +
    `  file => ${fileRef},\n` +
    `  responseFormat => {\n` +
    `    'schema': { 'type': 'object', 'properties': {\n` +
    `      'third_party_names':     {'type':'array','description':'Full names of every person who is NOT the claimant ${escLit(requesterName)} (neighbours, other occupants, council officers, landlords). Exclude ${escLit(requesterName)}.'},\n` +
    `      'third_party_phones':    {'type':'array','description':'Personal/direct telephone numbers that are NOT the claimant''s own number ${escLit(requesterPhone)}. Exclude the council''s published main switchboard number.'},\n` +
    `      'third_party_emails':    {'type':'array','description':'Personal email addresses of a named individual (a third party or a named officer). Exclude generic role/team mailboxes such as benefits@, info@, enquiries@.'},\n` +
    `      'third_party_addresses': {'type':'array','description':'Postal addresses of people other than the claimant ${escLit(requesterName)}'}\n` +
    `    }}\n` +
    `  },\n` +
    `  scores => TRUE\n` +
    `)`

  // One long-running round-trip: parse the PDF + selective extraction with scores.
  const t0 = Date.now()
  const rows = await querySnowflakeLongRunning(`
    SELECT
      TO_VARCHAR(AI_PARSE_DOCUMENT(${fileRef}, {'mode': 'LAYOUT'}):content) AS PARSED,
      TO_JSON(AI_EXTRACT(
        file => ${fileRef},
        responseFormat => {
          'schema': { 'type': 'object', 'properties': {
            'third_party_names':     {'type':'array','description':'Full names of every person who is NOT the claimant ${escLit(requesterName)} (neighbours, other occupants, council officers, landlords). Exclude ${escLit(requesterName)}.'},
            'third_party_phones':    {'type':'array','description':'Personal/direct telephone numbers that are NOT the claimant''s own number ${escLit(requesterPhone)}. Exclude the council''s published main switchboard number.'},
            'third_party_emails':    {'type':'array','description':'Personal email addresses of a named individual (a third party or a named officer). Exclude generic role/team mailboxes such as benefits@, info@, enquiries@.'},
            'third_party_addresses': {'type':'array','description':'Postal addresses of people other than the claimant ${escLit(requesterName)}'}
          }}
        },
        scores => TRUE
      )) AS EXTRACTED
  `)

  const parsedText = normWs(String(rows[0]?.PARSED ?? ""))
  let extracted: { response?: Record<string, unknown>; scoring?: { scores?: Record<string, { score?: number }> } } = {}
  try {
    const raw = rows[0]?.EXTRACTED
    extracted = (typeof raw === "string" ? JSON.parse(raw) : raw) ?? {}
  } catch {
    extracted = {}
  }
  const response = extracted.response ?? {}
  const scores = extracted.scoring?.scores ?? {}

  // Per-SAR cost metering — reuse the A5 pipeline, tagged stage='sar'.
  void logAiUsage("sar", claimRef, "ai_extract", parsedText, String(rows[0]?.EXTRACTED ?? ""), Date.now() - t0)

  // Pre-apply what the officer decided last time (the shared learning flywheel).
  const priorMap = await getRedactionPriorMap()

  // Flatten to per-entity findings, checking each value can be located in text.
  const findings: RedactionFinding[] = []
  for (const [field, category] of Object.entries(REDACT_CATEGORIES)) {
    const vals = Array.isArray(response[field]) ? (response[field] as unknown[]) : []
    const score = typeof scores[field]?.score === "number" ? (scores[field]!.score as number) : null
    for (const raw of vals) {
      const value = normWs(String(raw ?? "")).trim()
      if (!value) continue
      // Keep the council's own published switchboard visible — it is not
      // personal data and must not be redacted as third-party PII.
      if (category === "PHONE" && isOrgPhone(value)) continue
      // Role/team mailboxes are organisational, not third-party personal data.
      if (category === "EMAIL" && isOrgMailbox(value)) continue
      const located = parsedText.toLowerCase().includes(value.toLowerCase())
      const prior = priorMap.get(value.toLowerCase()) ?? null
      findings.push({ category, value, confidence: score, located, prior })
    }
  }

  // Build the redacted document. Redact atomic values (names, phones, emails),
  // plus address fragments split on commas so streets/postcodes are covered.
  // Longest needles first so a name inside an address is redacted as [NAME].
  const targets: { needle: string; label: string }[] = []
  for (const f of findings) {
    targets.push({ needle: f.value, label: f.category })
    if (f.category === "ADDRESS") {
      for (const frag of f.value.split(",")) {
        const t = frag.trim()
        if (t.length >= 4) targets.push({ needle: t, label: "ADDRESS" })
      }
    }
  }
  targets.sort((a, b) => b.needle.length - a.needle.length)

  let redactedText = parsedText
  let redactedCount = 0
  for (const t of targets) {
    const re = new RegExp(reEsc(t.needle), "gi")
    if (re.test(redactedText)) {
      redactedText = redactedText.replace(re, `[${t.label} REDACTED]`)
      redactedCount++
    }
  }

  // Requester's own identifiers we deliberately KEEP visible (SAR entitlement).
  const kept: string[] = []
  for (const own of [requesterName, requesterPhone, claimRef]) {
    if (own && parsedText.toLowerCase().includes(own.toLowerCase())) kept.push(own)
  }

  const learnedCount = findings.filter((f) => f.prior !== null).length

  return {
    parsedText,
    redactedText,
    findings,
    kept,
    redactedCount,
    requesterName,
    docKey: SAR_DEMO_FILE,
    learnedCount,
    sql: { parse: parseSql, extract: extractSql },
  }
}

/**
 * Persist the officer's keep/redact decisions from the Redaction Studio so the
 * next run can learn from them. Replaces any prior studio decision set for the
 * same document (one authoritative set per doc).
 */
export async function releaseRedactionDemo(input: {
  docKey: string
  decisions: { category: string; value: string; confidence: number | null; action: "KEEP" | "REDACT" }[]
}): Promise<{ ok: boolean; saved: number }> {
  const officer = "SAR Officer"
  const docKey = input.docKey || SAR_DEMO_FILE
  await querySnowflake(
    `DELETE FROM ${SCHEMA}.SAR_REDACTION_DECISION WHERE SOURCE = 'studio' AND DOC_KEY = '${esc(docKey)}'`,
  )
  const rows = input.decisions.filter((d) => d.value && (d.action === "KEEP" || d.action === "REDACT"))
  if (rows.length) {
    const values = rows
      .map((d) => {
        const conf =
          typeof d.confidence === "number" && Number.isFinite(d.confidence) ? String(d.confidence) : "NULL"
        return `('studio', '${esc(docKey)}', '${esc(d.category)}', '${escLit(d.value.trim().toLowerCase())}', '${d.action}', ${conf}, '${esc(officer)}')`
      })
      .join(", ")
    await querySnowflake(
      `INSERT INTO ${SCHEMA}.SAR_REDACTION_DECISION (SOURCE, DOC_KEY, CATEGORY, VALUE_NORM, ACTION, CONFIDENCE, DECIDED_BY) VALUES ${values}`,
    )
  }
  return { ok: true, saved: rows.length }
}

// ---------------------------------------------------------------------------
// SAR "across the estate" — the Subject Access Request story that shows what
// ONLY Snowflake does: one governed platform spanning unstructured docs
// (SharePoint/Exchange/file-share style) AND structured LOB records, with
// federated Cortex Search to find every record about a data subject, and
// governance (conditional masking + disclosure view) enforcing the SAR
// third-party rule in the data layer. Powers /sar. All demo data is synthetic.
// ---------------------------------------------------------------------------

export interface SarSubject {
  requesterName: string
  requesterPhone: string
  claimRef: string
  identityVerified: boolean
  verifiedOn: string
  verifiedBy: string
  verificationMethod: string
  verificationBasis: string
}
export interface SarCaseMeta {
  reference: string
  requester: string   // pseudonymised requester as it appears in the queue
  subjectSummary: string
  received: string
  due: string
  stage: string
  status: string
  clockState: string
}
export interface SarQueueRow {
  reference: string
  requester: string   // pseudonymised (FOI_CASE.REQUESTER_NAME)
  subjectSummary: string
  received: string
  due: string
  stage: string
  status: string
  clockState: string
  verified: boolean   // has a verified SAR_CASE_SUBJECT -> openable into the workspace
}
export interface SarFinding {
  source: string
  title: string
  date: string
  thirdPartyFlag: string
  webUrl: string
}
export interface SarStructuredRow {
  source: string
  name: string
  role: string
  ni: string
  phone: string
  address: string
}
export interface SarData {
  subject: SarSubject
  findings: SarFinding[]
  sources: string[]
  working: SarStructuredRow[]
  disclosure: SarStructuredRow[]
  caseMeta: SarCaseMeta | null
}

/** Acronyms that INITCAP mangles into title-case ("Ig" -> "IG"); restored whole-word. */
const SAR_TITLE_ACRONYMS = new Set(["IG", "SAR", "FOI", "EIR", "ICO", "NHS", "DWP"])

/** Tidy a filename-derived SAR document title: fix run-together words + acronym casing. */
function prettifySarTitle(raw: string): string {
  return raw
    .replace(/\bsocialcare\b/gi, "Social Care")
    .split(/\s+/)
    .map((w) => (SAR_TITLE_ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w))
    .join(" ")
    .trim()
}

/** SAR inbox: every SAR-regime case, pseudonymised requester, one-month clock, and whether
 * identity has been verified (which is what makes a case openable into the workspace). */
export async function getSarQueue(): Promise<SarQueueRow[]> {
  const rows = await querySnowflake(
    `SELECT c.REFERENCE, c.REQUESTER_NAME, c.SUBJECT,
            TO_VARCHAR(c.RECEIVED_DATE) AS RECEIVED,
            TO_VARCHAR(c.STATUTORY_DEADLINE) AS DUE,
            c.CURRENT_STAGE, c.STATUS, c.CLOCK_STATE,
            IFF(s.CASE_ID IS NOT NULL, TRUE, FALSE) AS VERIFIED
       FROM ${SCHEMA}.FOI_CASE c
       LEFT JOIN ${SCHEMA}.SAR_CASE_SUBJECT s
         ON s.CASE_ID = c.CASE_ID AND s.IDENTITY_VERIFIED = TRUE
      WHERE c.REGIME = 'SAR'
      ORDER BY VERIFIED DESC, c.RECEIVED_DATE DESC`,
  ).catch(() => [] as Record<string, unknown>[])
  return rows.map((r) => ({
    reference: String(r.REFERENCE ?? ""),
    requester: String(r.REQUESTER_NAME ?? ""),
    subjectSummary: String(r.SUBJECT ?? ""),
    received: String(r.RECEIVED ?? ""),
    due: String(r.DUE ?? ""),
    stage: String(r.CURRENT_STAGE ?? ""),
    status: String(r.STATUS ?? ""),
    clockState: String(r.CLOCK_STATE ?? ""),
    verified: Boolean(r.VERIFIED),
  }))
}

/** Everything the /sar workspace needs for ONE selected SAR case: the verified data subject,
 * federated search hits, masked working rows, disclosure bundle, and the case header meta.
 * Scoped by case reference; when the case has no verified subject (identity pending) it returns
 * an unverified subject and empty findings so the page can show "awaiting identity verification". */
export async function getSarData(caseRef?: string): Promise<SarData> {
  const subjRows = await querySnowflake(
    caseRef
      ? `SELECT s.REQUESTER_NAME, s.REQUESTER_PHONE, s.CLAIM_REFERENCE, s.IDENTITY_VERIFIED,
                s.VERIFIED_ON, s.VERIFIED_BY, s.VERIFICATION_METHOD, s.VERIFICATION_BASIS,
                c.REFERENCE, c.REQUESTER_NAME AS PSEUDONYM, c.SUBJECT AS SUBJECT_SUMMARY,
                TO_VARCHAR(c.RECEIVED_DATE) AS RECEIVED, TO_VARCHAR(c.STATUTORY_DEADLINE) AS DUE,
                c.CLOCK_STATE, c.CURRENT_STAGE, c.STATUS
           FROM ${SCHEMA}.FOI_CASE c
           LEFT JOIN ${SCHEMA}.SAR_CASE_SUBJECT s ON s.CASE_ID = c.CASE_ID
          WHERE c.REFERENCE = '${esc(caseRef)}' LIMIT 1`
      : `SELECT REQUESTER_NAME, REQUESTER_PHONE, CLAIM_REFERENCE, IDENTITY_VERIFIED,
                VERIFIED_ON, VERIFIED_BY, VERIFICATION_METHOD, VERIFICATION_BASIS,
                NULL AS REFERENCE, NULL AS PSEUDONYM, NULL AS SUBJECT_SUMMARY,
                NULL AS RECEIVED, NULL AS DUE, NULL AS CLOCK_STATE, NULL AS CURRENT_STAGE, NULL AS STATUS
           FROM ${SCHEMA}.SAR_CASE_SUBJECT LIMIT 1`,
  ).catch(() => [] as Record<string, unknown>[])

  const s = subjRows[0] ?? {}
  const verified = Boolean(s.IDENTITY_VERIFIED) && Boolean(s.REQUESTER_NAME)
  const subject: SarSubject = {
    requesterName: String(s.REQUESTER_NAME ?? ""),
    requesterPhone: String(s.REQUESTER_PHONE ?? ""),
    claimRef: String(s.CLAIM_REFERENCE ?? ""),
    identityVerified: verified,
    verifiedOn: String(s.VERIFIED_ON ?? ""),
    verifiedBy: String(s.VERIFIED_BY ?? ""),
    verificationMethod: String(s.VERIFICATION_METHOD ?? ""),
    verificationBasis: String(s.VERIFICATION_BASIS ?? ""),
  }
  const caseMeta: SarCaseMeta | null = caseRef
    ? {
        reference: String(s.REFERENCE ?? caseRef),
        requester: String(s.PSEUDONYM ?? ""),
        subjectSummary: String(s.SUBJECT_SUMMARY ?? ""),
        received: String(s.RECEIVED ?? ""),
        due: String(s.DUE ?? ""),
        stage: String(s.CURRENT_STAGE ?? ""),
        status: String(s.STATUS ?? ""),
        clockState: String(s.CLOCK_STATE ?? ""),
      }
    : null

  // Identity not yet verified -> no workspace data (and no Cortex Search spend).
  if (caseRef && !verified) {
    return { subject, findings: [], sources: [], working: [], disclosure: [], caseMeta }
  }

  // Federated subject search over the LIVE SharePoint corpus (Openflow -> SAR_SHAREPOINT_SEARCH).
  // The search is chunk-level (multiple chunks per document), so we de-duplicate to one row per
  // document; SOURCE_SYSTEM / DOC_DATE / third-party flag come from the SAR_SHAREPOINT_DOC_CORPUS
  // enrichment table (AI_CLASSIFY-derived flag).
  const findingsSpec = JSON.stringify({
    query: "James Whitfield housing benefit temporary accommodation social care complaint",
    columns: ["full_name", "web_url", "last_modified_date_time"],
    limit: 20,
  })
  const findingsQuery = querySnowflake(
    `SELECT e.SOURCE_SYSTEM AS SOURCE,
            INITCAP(REPLACE(REGEXP_REPLACE(f.value:full_name::string, '^/[0-9]{4}-[0-9]{2}-[0-9]{2}_|[.]docx$', ''), '_', ' ')) AS TITLE,
            e.DOC_DATE AS DOC_DATE, e.THIRD_PARTY_FLAG AS FLAG,
            f.value:web_url::string AS WEB_URL
     FROM TABLE(FLATTEN(input => PARSE_JSON(
       SNOWFLAKE.CORTEX.SEARCH_PREVIEW('${SAR_INGEST_SCHEMA}.SAR_SHAREPOINT_SEARCH', '${escLit(findingsSpec)}')
     ):results)) f
     LEFT JOIN ${SAR_INGEST_SCHEMA}.SAR_SHAREPOINT_DOC_CORPUS e ON e.FULL_NAME = f.value:full_name::string
     QUALIFY ROW_NUMBER() OVER (PARTITION BY f.value:full_name::string ORDER BY f.index) = 1
     ORDER BY DOC_DATE`,
  )
  // Officer working view — all structured rows; third-party PII masked by policy at the data layer.
  const workingQuery = querySnowflake(
    `SELECT SOURCE_SYSTEM, PERSON_NAME, PERSON_ROLE, NI_NUMBER, PHONE, HOME_ADDRESS
     FROM ${SCHEMA}.SAR_CARE_RECORD ORDER BY PERSON_ROLE, PERSON_NAME`,
  )
  // Disclosure bundle — the subject's own records only (row-level), masking inherited.
  const disclosureQuery = querySnowflake(
    `SELECT SOURCE_SYSTEM, PERSON_NAME, NI_NUMBER, PHONE, HOME_ADDRESS FROM ${SCHEMA}.V_SAR_DISCLOSURE`,
  )

  const [findingRows, workingRows, disclosureRows] = await Promise.all([
    findingsQuery, workingQuery, disclosureQuery,
  ])

  const findings: SarFinding[] = findingRows.map((r) => ({
    source: String(r.SOURCE ?? ""),
    title: prettifySarTitle(String(r.TITLE ?? "")),
    date: String(r.DOC_DATE ?? ""),
    thirdPartyFlag: String(r.FLAG ?? ""),
    webUrl: String(r.WEB_URL ?? ""),
  }))
  const working: SarStructuredRow[] = workingRows.map((r) => ({
    source: String(r.SOURCE_SYSTEM ?? ""),
    name: String(r.PERSON_NAME ?? ""),
    role: String(r.PERSON_ROLE ?? ""),
    ni: String(r.NI_NUMBER ?? ""),
    phone: String(r.PHONE ?? ""),
    address: String(r.HOME_ADDRESS ?? ""),
  }))
  const disclosure: SarStructuredRow[] = disclosureRows.map((r) => ({
    source: String(r.SOURCE_SYSTEM ?? ""),
    name: String(r.PERSON_NAME ?? ""),
    role: "SUBJECT",
    ni: String(r.NI_NUMBER ?? ""),
    phone: String(r.PHONE ?? ""),
    address: String(r.HOME_ADDRESS ?? ""),
  }))
  const sources = [...new Set(findings.map((f) => f.source).filter(Boolean))]
  return { subject, findings, sources, working, disclosure, caseMeta }
}

// ---------------------------------------------------------------------------
// Email Intake demo — compose/generate an inbound FOI email, run live Cortex
// triage (SENTIMENT + COMPLETE), then create a real (non-synthetic) case marked
// as demo-origin via a "-D" reference token. Powers /intake.
// ---------------------------------------------------------------------------

// Escape for a Snowflake single-quoted string literal (handles backslash + quote).
const escLit = (s: string) => (s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "''")

export const INTAKE_TONES: Record<string, string> = {
  Hostile:
    "openly angry and accusatory: complain about poor service, imply incompetence or a cover-up, and threaten to escalate to the ICO or the press. No pleasantries, no thanks.",
  Frustrated:
    "clearly frustrated and impatient: state this is a repeated/chased request, that previous handling was slow or inadequate, and express dissatisfaction, while staying civil. No thanks or pleasantries.",
  Neutral:
    "plain, transactional and businesslike: simply state the request. No warmth, no thanks, no complaints.",
  Polite: "polite and courteous, with a brief thank-you.",
  Appreciative: "warm and explicitly grateful, thanking the council for its help throughout.",
}

// Tone -> expected requester-sentiment band. When an email is GENERATED at a
// chosen tone we keep the real CORTEX.SENTIMENT value if it already falls in
// band (most authentic), otherwise pull it to the nearest bound so the demo
// never contradicts the selected tone. Manual / untoned text uses raw sentiment.
const TONE_SENTIMENT_BAND: Record<string, { min: number; max: number; anchor: number }> = {
  Hostile: { min: -1.0, max: -0.5, anchor: -0.7 },
  Frustrated: { min: -0.6, max: -0.2, anchor: -0.35 },
  Neutral: { min: -0.15, max: 0.15, anchor: 0.0 },
  Polite: { min: 0.15, max: 0.5, anchor: 0.3 },
  Appreciative: { min: 0.4, max: 0.9, anchor: 0.55 },
}

function clampSentimentToTone(score: number | null, tone?: string): number | null {
  if (!tone) return score
  const band = TONE_SENTIMENT_BAND[tone]
  if (!band) return score
  if (score == null) return band.anchor
  if (score < band.min) return band.min
  if (score > band.max) return band.max
  return score
}

// Strip ``` fences / json prefix the model sometimes wraps JSON in.
function stripFences(raw: string): string {
  let r = raw.trim()
  const m = r.match(/\{[\s\S]*\}/)
  return m ? m[0] : r
}

/** Generate a realistic inbound FOI email body + subject at a given tone. */
export async function generateEmail(tone: string, seedTopic: boolean): Promise<{ subject: string; body: string }> {
  const toneClause = INTAKE_TONES[tone] ?? INTAKE_TONES.Neutral
  let topic = ""
  if (seedTopic) {
    try {
      const t = await querySnowflake(`
        SELECT DOCUMENT_TITLE FROM ${SCHEMA}.CAMDEN_FOI_RESPONSES
        WHERE DOCUMENT_TITLE IS NOT NULL ORDER BY RANDOM() LIMIT 1
      `)
      topic = String(t[0]?.DOCUMENT_TITLE ?? "")
    } catch { topic = "" }
  }
  const topicClause = topic
    ? `about this topic: ${topic}.`
    : "about a realistic UK local-government matter (planning, council tax, social care, waste, highways)."
  const prompt =
    `Write the body of a realistic Freedom of Information request email to a UK council, ${topicClause} ` +
    `The requester's tone must be unmistakable from the wording: ${toneClause} ` +
    `60 to 120 words, no placeholders. ` +
    `After the body, add a final line starting 'SUBJECT:' with a short email subject line.`
  const rows = await querySnowflake(
    `SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '${escLit(prompt)}') R`,
  )
  const raw = String(rows[0]?.R ?? "").trim()
  let subject = "Freedom of Information request"
  let body = raw
  const idx = raw.indexOf("SUBJECT:")
  if (idx >= 0) {
    body = raw.slice(0, idx).trim()
    subject = raw.slice(idx + 8).split("\n")[0].trim().replace(/^["']|["']$/g, "") || subject
  }
  return { subject, body }
}

/**
 * Run live Cortex triage over an email's text. Returns a CaseTriage (no write).
 * When `tone` is supplied (the email was generated at a chosen tone) the displayed
 * sentiment is clamped to that tone's band for demo reliability; without a tone the
 * raw CORTEX.SENTIMENT value is used.
 */
export async function triageEmail(text: string, tone?: string): Promise<CaseTriage | null> {
  const prompt =
    "You are an expert UK local-government FOI officer. Return STRICT JSON only (no prose, no code fences) with keys: " +
    "priority (HIGH/MEDIUM/LOW), complexity_score (number 1-10), " +
    "complexity_factors (array of 2-4 short phrases explaining why it is that complex), " +
    "sentiment_rationale (one sentence on what tone/wording drives requester sentiment), " +
    "suggested_departments (array), estimated_hours (number), " +
    "summary (1 sentence). REQUEST: " + text + " JSON only."
  const vexPrompt =
    "Is this request vexatious under s.14 FOIA (abusive, disproportionate, part of a repeated campaign, or intended to harass)? " + text
  const t0 = Date.now()
  // Purpose-built Cortex AI SQL: SENTIMENT (tone), AI_CLASSIFY (regime),
  // AI_FILTER (s.14 vexatious), AI_EXTRACT (scope), COMPLETE (narrative detail).
  const rows = await querySnowflake(`
    SELECT SNOWFLAKE.CORTEX.SENTIMENT('${escLit(text)}') S,
           SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '${escLit(prompt)}') R,
           (AI_CLASSIFY('${escLit(text)}', ['FOI','EIR','SAR','BAU']):labels[0])::string AS REGIME,
           AI_FILTER('${escLit(vexPrompt)}') AS VEX,
           (AI_EXTRACT(text => '${escLit(text)}', responseFormat => {'date_range':'What time period does the request cover?','departments':'Which council departments or services are named or implied?','documents':'What specific documents or datasets are requested?'}):response) AS SCOPE
  `)
  // A5: meter this triage call. Pre-case, so no case ref yet — still counts to totals.
  void logAiUsage("triage", null, "mistral-large2", prompt, String(rows[0]?.R ?? ""), Date.now() - t0)
  const rawSent = rows[0]?.S == null ? null : Number(rows[0].S)
  const sent = clampSentimentToTone(rawSent, tone)
  let cl: Record<string, unknown>
  try {
    cl = JSON.parse(stripFences(String(rows[0]?.R ?? "")))
  } catch {
    return null
  }
  const cx = Number(cl.complexity_score)
  const regime = String(rows[0]?.REGIME ?? "").toUpperCase()
  const classification = ["FOI", "EIR", "SAR", "BAU"].includes(regime) ? regime : String(cl.category ?? "FOI")
  const vexRaw = rows[0]?.VEX
  const isVexatious = vexRaw === true || String(vexRaw).toLowerCase() === "true"
  let scope: CaseTriage["scope"] = null
  try {
    const sc = typeof rows[0]?.SCOPE === "string" ? JSON.parse(rows[0].SCOPE) : rows[0]?.SCOPE
    const clean = (v: unknown) => { const s = String(v ?? "").trim(); return s && s.toLowerCase() !== "none" ? s : "" }
    if (sc) scope = { dateRange: clean(sc.date_range), departments: clean(sc.departments), documents: clean(sc.documents) }
  } catch { scope = null }
  return {
    classification,
    priority: String(cl.priority ?? "MEDIUM"),
    complexityScore: Number.isFinite(cx) ? cx : null,
    complexityFactors: asStringArray(cl.complexity_factors),
    sentimentScore: sent,
    sentimentRationale: String(cl.sentiment_rationale ?? ""),
    departments: asStringArray(cl.suggested_departments),
    estimatedHours: cl.estimated_hours == null ? null : Number(cl.estimated_hours),
    isVexatious,
    summary: String(cl.summary ?? ""),
    model: "mistral-large2",
    confidence: null,
    computedAt: new Date().toISOString(),
    s21MatchRef: "",
    scope,
  }
}

function intakeRef(regime: string): string {
  const pref = regime === "EIR" ? "EIR" : regime === "SAR" ? "SAR" : "FOI"
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  const stamp = `${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  return `${pref}-${d.getFullYear()}-D${stamp}`
}

/**
 * Create a real, non-synthetic case from a triaged email, marked demo-origin by
 * its "-D" reference. Writes FOI_CASE + FOI_TRIAGE (TRIAGE_JSON + REASONING_JSON)
 * + a FOI_CASE_EVENT triage decision. Returns the new reference.
 */
export async function createIntakeCase(input: {
  subject: string
  body: string
  senderName: string
  triage: CaseTriage
}): Promise<{ reference: string }> {
  const { subject, body, senderName, triage } = input
  const regime = triage.classification === "EIR" ? "EIR" : triage.classification === "SAR" ? "SAR" : "FOI"
  const reference = intakeRef(regime)
  const dept = triage.departments[0] ?? ""
  const baseTitle = (triage.summary || subject || "Request").slice(0, 80)
  const title = baseTitle.startsWith("(Demo) ") ? baseTitle : `(Demo) ${baseTitle}`
  const cx = triage.complexityScore ?? 5
  const sent = triage.sentimentScore ?? 0
  const requestText = `${subject}\n\n${body}`

  const deadlineSql =
    `(SELECT MIN(c2.CAL_DATE) FROM ${SCHEMA}.CALENDAR c2 WHERE c2.IS_WORKING_DAY ` +
    `AND c2.WD_INDEX=(SELECT WD_INDEX FROM ${SCHEMA}.CALENDAR WHERE CAL_DATE=CURRENT_DATE())+20)`

  await querySnowflake(`
    INSERT INTO ${SCHEMA}.FOI_CASE (REFERENCE, SOURCE, REQUESTER_NAME, REQUEST_TEXT, RECEIVED_DATE,
      REGIME, CURRENT_STAGE, STATUS, OWNING_DEPARTMENT, STATUTORY_DEADLINE, CLOCK_STATE, SENTIMENT_SCORE,
      COMPLEXITY_RANK, IS_VEXATIOUS, SUBJECT, IS_SYNTHETIC)
    SELECT '${escLit(reference)}','EMAIL','${escLit(senderName)}','${escLit(requestText)}',CURRENT_DATE(),
           '${regime}','CLASSIFY','OPEN','${escLit(dept)}',${deadlineSql},'RUNNING',${sent},
           ${cx},${triage.isVexatious ? "TRUE" : "FALSE"},'${escLit(title)}',FALSE
  `)

  const idRows = await querySnowflake(
    `SELECT CASE_ID FROM ${SCHEMA}.FOI_CASE WHERE REFERENCE='${escLit(reference)}' LIMIT 1`,
  )
  const caseId = String(idRows[0]?.CASE_ID ?? "")

  const triageJson = {
    category: triage.classification, priority: triage.priority, complexity_score: cx,
    estimated_hours: triage.estimatedHours, is_vexatious: triage.isVexatious,
    suggested_departments: triage.departments, summary: triage.summary,
    scope: triage.scope
      ? { date_range: triage.scope.dateRange, departments: triage.scope.departments, documents: triage.scope.documents }
      : null,
  }
  const reasoningJson = {
    complexity_factors: triage.complexityFactors,
    sentiment_rationale: triage.sentimentRationale,
  }
  await querySnowflake(`
    INSERT INTO ${SCHEMA}.FOI_TRIAGE (CASE_ID, TRIAGE_JSON, REASONING_JSON, COMPLEXITY_RANK, MODEL, COMPUTED_AT)
    SELECT '${escLit(caseId)}', PARSE_JSON('${escLit(JSON.stringify(triageJson))}'),
           PARSE_JSON('${escLit(JSON.stringify(reasoningJson))}'), ${cx}, 'mistral-large2', CURRENT_TIMESTAMP()
  `)
  await querySnowflake(`
    INSERT INTO ${SCHEMA}.FOI_CASE_EVENT (CASE_ID, TO_STAGE, ACTOR_TYPE, ACTOR, EVENT_TYPE, NOTE)
    SELECT '${escLit(caseId)}', 'CLASSIFY', 'AI', 'mistral-large2', 'DECISION', 'Auto-triage from email intake (demo)'
  `)
  // s.21 already-published check (AI_SIMILARITY vs the council's own corpus).
  await querySnowflake(`CALL ${SCHEMA}.SP_FLAG_S21_REUSE('${escLit(caseId)}')`).catch(() => {})
  return { reference }
}

/** Remove all demo-intake cases (the "-D" reference token) across the 3 tables. */
export async function clearDemoIntakeCases(): Promise<{ deleted: number }> {
  const pattern = `'.*-[0-9]{4}-D[0-9]+$'`
  const refRows = await querySnowflake(
    `SELECT CASE_ID FROM ${SCHEMA}.FOI_CASE WHERE REFERENCE RLIKE ${pattern}`,
  )
  const ids = refRows.map((r) => String(r.CASE_ID ?? "")).filter(Boolean)
  if (!ids.length) return { deleted: 0 }
  const inList = ids.map((id) => `'${escLit(id)}'`).join(",")
  await querySnowflake(`DELETE FROM ${SCHEMA}.FOI_CASE_EVENT WHERE CASE_ID IN (${inList})`)
  await querySnowflake(`DELETE FROM ${SCHEMA}.FOI_TRIAGE WHERE CASE_ID IN (${inList})`)
  await querySnowflake(`DELETE FROM ${SCHEMA}.FOI_CASE WHERE CASE_ID IN (${inList})`)
  return { deleted: ids.length }
}

export interface OutlookSyncResult {
  ok: boolean
  mailbox: string
  polled: number
  skippedExisting: number
  newCases: { reference: string; subject: string; sender: string }[]
  error?: string
}

/**
 * Poll the shared Outlook mailbox via Microsoft Graph and turn each new email
 * into a triaged, demo-marked case. All Graph + Cortex work runs inside the
 * SP_POLL_OUTLOOK_INBOX stored proc (external access + client-credentials).
 */
export async function syncOutlookInbox(mailbox?: string): Promise<OutlookSyncResult> {
  const arg = mailbox ? `'${esc(mailbox)}'` : ""
  const rows = await querySnowflakeLongRunning(`CALL ${SCHEMA}.SP_POLL_OUTLOOK_INBOX(${arg})`)
  const raw = rows[0]?.SP_POLL_OUTLOOK_INBOX
  const v = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {})
  return {
    ok: Boolean(v.ok),
    mailbox: String(v.mailbox ?? ""),
    polled: n(v.polled),
    skippedExisting: n(v.skipped_existing),
    newCases: Array.isArray(v.new_cases)
      ? v.new_cases.map((c: any) => ({
          reference: String(c.reference ?? ""),
          subject: String(c.subject ?? ""),
          sender: String(c.sender ?? ""),
        }))
      : [],
    error: v.error ? String(v.error) : v.graph_status && !v.ok ? `Graph returned ${v.graph_status}` : undefined,
  }
}

export interface OutlookMessage {
  id: string
  sender: string
  senderEmail: string
  subject: string
  received: string
  preview: string
  body: string
}

/** Read-only peek at unread mail in the shared mailbox (no landing/triage). */
export async function peekOutlookInbox(mailbox?: string): Promise<{ ok: boolean; mailbox: string; messages: OutlookMessage[]; error?: string }> {
  const arg = mailbox ? `'${esc(mailbox)}'` : ""
  const rows = await querySnowflakeLongRunning(`CALL ${SCHEMA}.SP_PEEK_OUTLOOK_INBOX(${arg})`)
  const raw = rows[0]?.SP_PEEK_OUTLOOK_INBOX
  const v = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {})
  return {
    ok: Boolean(v.ok),
    mailbox: String(v.mailbox ?? ""),
    messages: Array.isArray(v.messages)
      ? v.messages.map((m: any) => ({
          id: String(m.id ?? ""),
          sender: String(m.sender ?? ""),
          senderEmail: String(m.sender_email ?? ""),
          subject: String(m.subject ?? ""),
          received: String(m.received ?? ""),
          preview: String(m.preview ?? ""),
          body: String(m.body ?? ""),
        }))
      : [],
    error: v.error ? String(v.error) : v.graph_status && !v.ok ? `Graph returned ${v.graph_status}` : undefined,
  }
}

export interface IntakePipelineResult {
  reference: string
  ok: boolean
  classification: string
  triage: {
    category: string; priority: string; complexity: number | null
    departments: string[]; estimatedHours: number | null; isVexatious: boolean; summary: string
  } | null
  precedents: AnswerSource[]
  answer: string
  answerGrounded: boolean
  evaluation: { groundedness: number | null; coverage: number | null; verdict: string | null } | null
  draft: string
  benchmark: {
    comparability: number | null; verdict: string | null; rationale: string
    peerAuthority: string; peerTitle: string; peerUrl: string
  } | null
  error?: string
}

/**
 * Benchmark a compiled draft against the closest REAL published disclosure from a
 * peer UK authority (Camden or GLA), scoring how comparable it is in completeness.
 * Answers the "is this as good as a real WhatDoTheyKnow response?" question.
 */
async function benchmarkAgainstPeers(q: string, draft: string): Promise<IntakePipelineResult["benchmark"]> {
  if (!draft.trim()) return null
  const [camden, gla] = await Promise.all([
    cortexSearch("CAMDEN_FOI_SEARCH", q, ["DOCUMENT_TITLE", "DOCUMENT_TEXT"], 1),
    cortexSearch("GLA_DISCLOSURE_SEARCH", q, ["TITLE", "RESPONSE_TEXT", "SOURCE_URL", "AUTHORITY_NAME"], 1),
  ])
  const camdenText = String(camden[0]?.DOCUMENT_TEXT ?? "")
  const glaText = String(gla[0]?.RESPONSE_TEXT ?? "")
  let peer: { authority: string; title: string; url: string; text: string } | null = null
  if (camdenText.length >= glaText.length && camdenText.length > 40) {
    peer = { authority: "London Borough of Camden", title: String(camden[0]?.DOCUMENT_TITLE ?? ""), url: "", text: camdenText }
  } else if (glaText.length > 40) {
    peer = { authority: String(gla[0]?.AUTHORITY_NAME ?? "Greater London Authority"), title: String(gla[0]?.TITLE ?? ""), url: String(gla[0]?.SOURCE_URL ?? ""), text: glaText }
  }
  if (!peer) return null
  const prompt =
    "You are benchmarking a DRAFT FOI response against a REAL published disclosure from a peer UK authority answering a similar request. " +
    "Judge how comparable the draft is in completeness, specificity and statutory handling. " +
    'Return ONLY JSON: {"comparability":<0-1 float>,"verdict":"COMPARABLE|PARTIAL|BELOW","rationale":"<one sentence>"}.\n\n' +
    "PEER DISCLOSURE (" + peer.authority + "):\n" + peer.text.slice(0, 1500) + "\n\nOUR DRAFT:\n" + draft.slice(0, 1800) + "\n\nJSON:"
  const rows = await querySnowflakeLongRunning(
    `SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '${escLit(prompt)}') AS R`,
  )
  let comparability: number | null = null
  let verdict: string | null = null
  let rationale = ""
  try {
    const raw = String(rows[0]?.R ?? "")
    const j = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)
    const parsed = JSON.parse(j)
    comparability = parsed.comparability == null ? null : Number(parsed.comparability)
    verdict = parsed.verdict ? String(parsed.verdict).toUpperCase() : null
    rationale = String(parsed.rationale ?? "")
  } catch { /* leave nulls */ }
  return { comparability, verdict, rationale, peerAuthority: peer.authority, peerTitle: peer.title, peerUrl: peer.url }
}

/**
 * Orchestrate the downstream pipeline for one just-created case, reusing the
 * existing per-stage logic (no new pipeline logic): read the triage the poller
 * already computed, run the grounded suggested answer + LLM-judge eval
 * (precomputeSuggestedAnswer → getSuggestedAnswer), and generate the compliant
 * draft (generateResponse → getResponses). Returns every stage's real output so
 * the Intake "notebook" can render them.
 */
export async function runIntakePipeline(reference: string): Promise<IntakePipelineResult> {
  const empty: IntakePipelineResult = {
    reference, ok: false, classification: "", triage: null, precedents: [],
    answer: "", answerGrounded: false, evaluation: null, draft: "", benchmark: null,
  }
  const rows = await querySnowflake(`
    SELECT c.CASE_ID, c.REGIME, c.SUBJECT, c.REQUEST_TEXT,
           t.TRIAGE_JSON:category::string AS CATEGORY,
           t.TRIAGE_JSON:priority::string AS PRIORITY,
           t.TRIAGE_JSON:complexity_score::int AS CX,
           t.TRIAGE_JSON:estimated_hours::float AS HOURS,
           t.TRIAGE_JSON:is_vexatious::boolean AS VEX,
           t.TRIAGE_JSON:summary::string AS SUMMARY,
           t.TRIAGE_JSON:suggested_departments AS DEPTS
    FROM ${SCHEMA}.FOI_CASE c
    LEFT JOIN ${SCHEMA}.FOI_TRIAGE t ON t.CASE_ID = c.CASE_ID
    WHERE c.REFERENCE = '${esc(reference)}' LIMIT 1`)
  if (!rows.length) return { ...empty, error: "Case not found" }
  const r = rows[0]
  const caseId = String(r.CASE_ID ?? "")
  const classification = String(r.REGIME ?? "")
  let departments: string[] = []
  try {
    const raw = r.DEPTS
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    if (Array.isArray(parsed)) departments = parsed.map((d) => String(d))
  } catch { /* leave empty */ }
  const triage = {
    category: String(r.CATEGORY ?? classification ?? ""),
    priority: String(r.PRIORITY ?? ""),
    complexity: r.CX == null ? null : Number(r.CX),
    departments,
    estimatedHours: r.HOURS == null ? null : Number(r.HOURS),
    isVexatious: r.VEX === true,
    summary: String(r.SUMMARY ?? ""),
  }

  // Stages 3-5: grounded answer (sources = closest prior requests) + LLM-judge eval.
  const ev = await precomputeSuggestedAnswer(reference)
  const sa = await getSuggestedAnswer(reference)

  // Stage 6: compliant draft, of the outcome type triage suggests.
  const { type: intakeType } = await suggestedResponseType(reference)
  await generateResponse(reference, intakeType)
  const drafts = await getResponses(caseId)
  const draft = (drafts[0]?.finalText || drafts[0]?.draftText || "").trim()

  // Stage 6b: benchmark the draft against a real peer disclosure (Camden / GLA).
  const benchQ = `${String(r.SUBJECT ?? "")} ${String(r.REQUEST_TEXT ?? "")}`.trim().slice(0, 1200)
  const benchmark = await benchmarkAgainstPeers(benchQ, draft)

  return {
    reference, ok: true, classification, triage,
    precedents: sa?.sources ?? [],
    answer: sa?.answer ?? "",
    answerGrounded: sa?.grounded ?? false,
    evaluation: { groundedness: ev.groundedness ?? null, coverage: ev.coverage ?? null, verdict: ev.verdict ?? null },
    draft,
    benchmark,
  }
}

// ---------------------------------------------------------------------------
// Performance Reporting (s.45 Code part 8.5) — timeliness KPIs, regime/outcome
// breakdowns, monthly volume, department workload. Ported from reporting.py.
// ---------------------------------------------------------------------------

export interface ReportingStats {
  closed: number
  inTime: number
  pct: number
  byRegime: { regime: string; closed: number; pctInTime: number }[]
  byOutcome: { outcome: string; n: number }[]
  monthly: { month: string; received: number }[]
  departments: { department: string; open: number; overdue: number }[]
}

export async function getReportingStats(): Promise<ReportingStats> {
  const [tl, reg, out, mon, dep] = await Promise.all([
    querySnowflake(`
      SELECT COUNT(*) CLOSED, SUM(IFF(ANSWERED_IN_TIME,1,0)) IN_TIME,
             ROUND(100*SUM(IFF(ANSWERED_IN_TIME,1,0))/NULLIF(COUNT(*),0),1) PCT
      FROM ${SCHEMA}.FOI_CASE WHERE STATUS='CLOSED'
    `),
    querySnowflake(`
      SELECT REGIME, COUNT(*) CLOSED,
             ROUND(100*SUM(IFF(ANSWERED_IN_TIME,1,0))/NULLIF(COUNT(*),0),0) PCT_IN_TIME
      FROM ${SCHEMA}.FOI_CASE WHERE STATUS='CLOSED' GROUP BY REGIME ORDER BY REGIME
    `),
    querySnowflake(`
      SELECT OUTCOME, COUNT(*) N FROM ${SCHEMA}.FOI_CASE
      WHERE STATUS='CLOSED' AND OUTCOME IS NOT NULL GROUP BY OUTCOME ORDER BY N DESC
    `),
    querySnowflake(`
      SELECT DATE_TRUNC('month', RECEIVED_DATE)::DATE MONTH, COUNT(*) RECEIVED
      FROM ${SCHEMA}.FOI_CASE WHERE RECEIVED_DATE IS NOT NULL
      GROUP BY 1 ORDER BY 1
    `),
    querySnowflake(`
      SELECT OWNING_DEPARTMENT DEPT, COUNT(*) OPEN_CASES, SUM(IFF(WD_REMAINING<0,1,0)) OVERDUE
      FROM ${SCHEMA}.V_CASE WHERE STATUS='OPEN' AND NOT COALESCE(IS_SYNTHETIC,FALSE)
      GROUP BY 1 ORDER BY OPEN_CASES DESC
    `),
  ])
  const t = tl[0] ?? {}
  return {
    closed: n(t.CLOSED),
    inTime: n(t.IN_TIME),
    pct: t.PCT == null ? 0 : Number(t.PCT),
    byRegime: reg.map((r) => ({ regime: String(r.REGIME ?? ""), closed: n(r.CLOSED), pctInTime: r.PCT_IN_TIME == null ? 0 : Number(r.PCT_IN_TIME) })),
    byOutcome: out.map((r) => ({ outcome: String(r.OUTCOME ?? ""), n: n(r.N) })),
    monthly: mon.map((r) => ({ month: String(r.MONTH ?? ""), received: n(r.RECEIVED) })),
    departments: dep.map((r) => ({ department: String(r.DEPT ?? "Unassigned"), open: n(r.OPEN_CASES), overdue: n(r.OVERDUE) })),
  }
}

// ---------------------------------------------------------------------------
// Cost of processing an FOI (for the economic buyer). Modelled from the triage
// estimated officer-hours x the council's charge-out rate (s.12 basis: £25/hr,
// £450 / 18hr appropriate limit). FOI_COST_ESTIMATE holds detailed estimates
// for the few cases worked near the limit; this models the whole population.
// ---------------------------------------------------------------------------

// Published comparator (attributed). Frontier Economics' 2012 review for the
// Ministry of Justice estimated the average cost of an FOI request to central
// government at roughly £164; independent local-government estimates typically
// fall in the £100–£200 range. Cited as a sanity-check, not a target.
export const FOI_COST_BENCHMARK = {
  low: 150,
  high: 300,
  source: "Frontier Economics for the Ministry of Justice (2012), uprated for inflation to 2026, with independent local-authority estimates",
}

export interface CostOfProcessing {
  ratePerHour: number
  limitGbp: number
  limitHours: number
  nCases: number
  avgHours: number
  avgCostGbp: number
  medianCostGbp: number
  totalCostGbp: number
  annualisedCostGbp: number
  annualVolume: number
  pctOverLimit: number
}

export async function getCostOfProcessing(): Promise<CostOfProcessing> {
  const cfg = await querySnowflake(
    `SELECT MAX(IFF(CONFIG_KEY='COST_RATE_PER_HOUR', CONFIG_VALUE, NULL)) RATE,
            MAX(IFF(CONFIG_KEY='COST_LIMIT_GBP', CONFIG_VALUE, NULL)) LIMIT_GBP,
            MAX(IFF(CONFIG_KEY='COST_LIMIT_HOURS', CONFIG_VALUE, NULL)) LIMIT_HRS
       FROM ${SCHEMA}.COUNCIL_CONFIG`,
  )
  const rate = Number(cfg[0]?.RATE ?? 25) || 25
  const limitGbp = Number(cfg[0]?.LIMIT_GBP ?? 450) || 450
  const limitHours = Number(cfg[0]?.LIMIT_HRS ?? 18) || 18

  const rows = await querySnowflake(`
    WITH h AS (
      SELECT c.CASE_ID,
             c.RECEIVED_DATE,
             TRY_TO_DOUBLE(t.TRIAGE_JSON:estimated_hours::string) AS est_hours
      FROM ${SCHEMA}.FOI_CASE c
      JOIN ${SCHEMA}.FOI_TRIAGE t ON t.CASE_ID = c.CASE_ID
    )
    SELECT COUNT(est_hours) AS N_CASES,
           ROUND(AVG(est_hours), 1) AS AVG_HOURS,
           ROUND(AVG(est_hours) * ${rate}, 0) AS AVG_COST,
           ROUND(MEDIAN(est_hours) * ${rate}, 0) AS MEDIAN_COST,
           ROUND(SUM(est_hours) * ${rate}, 0) AS TOTAL_COST,
           SUM(IFF(est_hours > ${limitHours}, 1, 0)) AS N_OVER,
           COUNT(IFF(RECEIVED_DATE >= DATEADD('year', -1, CURRENT_DATE), 1, NULL)) AS N_LAST_YEAR
    FROM h
  `)
  const r = rows[0] ?? {}
  const nCases = n(r.N_CASES)
  const avgCost = Number(r.AVG_COST ?? 0)
  const annualVolume = n(r.N_LAST_YEAR) || nCases
  return {
    ratePerHour: rate,
    limitGbp,
    limitHours,
    nCases,
    avgHours: Number(r.AVG_HOURS ?? 0),
    avgCostGbp: avgCost,
    medianCostGbp: Number(r.MEDIAN_COST ?? 0),
    totalCostGbp: Number(r.TOTAL_COST ?? 0),
    annualVolume,
    annualisedCostGbp: Math.round(avgCost * annualVolume),
    pctOverLimit: nCases ? Math.round((n(r.N_OVER) / nCases) * 100) : 0,
  }
}

// ---------------------------------------------------------------------------
// Automation economics — the cost-effectiveness case for the economic buyer.
// Product run-cost per FOI is MODELLED from Snowflake Cortex + compute usage;
// it is deliberately conservative and clearly labelled as an estimate in the UI.
// ---------------------------------------------------------------------------
export const AUTOMATION_COST = {
  llmGbp: 0.08, // triage + suggested answer + LLM-judge + compiled draft (mistral-large2 tokens); aligned with measured ~£0.075/request
  searchGbp: 0.02, // Cortex Search retrieval across the precedent/guidance corpora
  computeGbp: 0.02, // XS warehouse seconds for orchestration + table writes
  perFoiGbp: 0.12, // sum of the above, per request, end-to-end
  reviewFraction: 0.2, // officer review time retained under human-in-the-loop (~20% of full manual handling)
  source: "Modelled from Cortex mistral-large2 token usage, Cortex Search, and XS-warehouse seconds at 2026 list rates",
}

export interface AutomationEconomics {
  productCostPerFoi: number
  officerReviewCostPerFoi: number
  assistedCostPerFoi: number
  manualCostPerFoi: number
  savingsPerFoi: number
  pctReduction: number
  annualManualGbp: number
  annualAssistedGbp: number
  annualSavingsGbp: number
  annualVolume: number
}

export function computeAutomationEconomics(manualCostPerFoi: number, annualVolume: number): AutomationEconomics {
  const productCostPerFoi = AUTOMATION_COST.perFoiGbp
  const officerReviewCostPerFoi = Math.round(manualCostPerFoi * AUTOMATION_COST.reviewFraction * 100) / 100
  const assistedCostPerFoi = Math.round((productCostPerFoi + officerReviewCostPerFoi) * 100) / 100
  const savingsPerFoi = Math.max(0, Math.round((manualCostPerFoi - assistedCostPerFoi) * 100) / 100)
  const pctReduction = manualCostPerFoi > 0 ? Math.round((savingsPerFoi / manualCostPerFoi) * 100) : 0
  return {
    productCostPerFoi,
    officerReviewCostPerFoi,
    assistedCostPerFoi,
    manualCostPerFoi,
    savingsPerFoi,
    pctReduction,
    annualManualGbp: Math.round(manualCostPerFoi * annualVolume),
    annualAssistedGbp: Math.round(assistedCostPerFoi * annualVolume),
    annualSavingsGbp: Math.round(savingsPerFoi * annualVolume),
    annualVolume,
  }
}

// ---------------------------------------------------------------------------
// A5 — MEASURED cost. Every Cortex call is logged to FOI_AI_USAGE with real
// COUNT_TOKENS + latency, costed via the editable AI_MODEL_RATE_CARD. This is
// the real, rolling per-request cost that sits alongside the modelled figure.
// Tokens/latency are measured; the GBP conversion uses list-rate estimates.
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget metering of a single Cortex call. Never throws into the
 * caller's path — a logging failure must not break the pipeline.
 */
export async function logAiUsage(
  stage: string,
  caseRef: string | null,
  model: string,
  promptText: string,
  responseText: string,
  latencyMs: number,
): Promise<void> {
  const ref = caseRef ? `'${escLit(caseRef)}'` : "NULL"
  const sql = `
    INSERT INTO ${SCHEMA}.FOI_AI_USAGE (STAGE, CASE_REF, MODEL, INPUT_TOKENS, OUTPUT_TOKENS, LATENCY_MS, EST_CREDITS, EST_GBP)
    WITH tok AS (
      SELECT '${escLit(stage)}' AS stage, ${ref} AS ref, '${escLit(model)}' AS model,
        SNOWFLAKE.CORTEX.COUNT_TOKENS('mistral-large2', '${escLit(promptText)}') AS it,
        SNOWFLAKE.CORTEX.COUNT_TOKENS('mistral-large2', '${escLit(responseText)}') AS ot,
        ${Math.max(0, Math.round(latencyMs))} AS lat
    )
    SELECT t.stage, t.ref, t.model, t.it, t.ot, t.lat,
      ((t.it + t.ot) / 1e6) * COALESCE(rc.CREDITS_PER_1M_TOKENS, dflt.CREDITS_PER_1M_TOKENS) AS est_credits,
      ((t.it + t.ot) / 1e6) * COALESCE(rc.CREDITS_PER_1M_TOKENS, dflt.CREDITS_PER_1M_TOKENS) * cfg.VALUE_NUM AS est_gbp
    FROM tok t
    LEFT JOIN ${SCHEMA}.AI_MODEL_RATE_CARD rc ON rc.MODEL = t.model
    CROSS JOIN (SELECT CREDITS_PER_1M_TOKENS FROM ${SCHEMA}.AI_MODEL_RATE_CARD WHERE MODEL = '_DEFAULT') dflt
    CROSS JOIN (SELECT VALUE_NUM FROM ${SCHEMA}.AI_COST_CONFIG WHERE CONFIG_KEY = 'CREDIT_PRICE_GBP') cfg
  `
  try {
    await querySnowflake(sql)
  } catch (e) {
    console.warn("[ai-usage] metering log failed (non-fatal):", e instanceof Error ? e.message : e)
  }
}

/**
 * A6 - append a tamper-evident AI-decision record via SP_LOG_AI_DECISION. Stores only SHA2
 * hashes of the prompt/response (raw text, which may contain third-party PII, is never persisted)
 * plus model, Snowflake version, tokens, cost and confidence, chained by ROW_HASH. Fire-and-forget:
 * an audit-log failure must never break the officer-facing pipeline.
 */
export async function logAiDecision(
  caseRef: string | null,
  decisionType: string,
  model: string,
  prompt: string,
  response: string,
  confidence: number | null,
  summary: string,
): Promise<void> {
  const ref = caseRef ? `'${escLit(caseRef)}'` : "NULL"
  const conf = confidence == null ? "NULL" : Number(confidence)
  const sql = `CALL ${SCHEMA}.SP_LOG_AI_DECISION(${ref}, '${escLit(decisionType)}', '${escLit(model)}', '${escLit(prompt)}', '${escLit(response)}', ${conf}, '${escLit(summary)}')`
  try {
    await querySnowflake(sql)
  } catch (e) {
    console.warn("[ai-decision] audit log failed (non-fatal):", e instanceof Error ? e.message : e)
  }
}

export interface AiDecisionRecord {
  seq: number
  decisionType: string
  model: string
  sfVersion: string
  inputTokens: number | null
  outputTokens: number | null
  estGbp: number | null
  confidence: number | null
  summary: string
  decidedAt: string
  promptHash: string
  responseHash: string
}
export interface AiAuditTrail {
  decisions: AiDecisionRecord[]
  chainIntact: boolean
  totalGbp: number | null
}

/**
 * A6 - the tamper-evident AI audit trail for one case, plus a GLOBAL chain-integrity check.
 * chainIntact recomputes every ROW_HASH from its stored fields and verifies each PREV_HASH links
 * to the prior row - so any edit/insert/delete to the append-only log flips it to false.
 */
export async function getAiAuditTrail(reference: string): Promise<AiAuditTrail> {
  const chainRows = await querySnowflake(
    `SELECT MIN(IFF(row_ok AND prev_ok, 1, 0)) AS ALL_OK, COUNT(*) AS N
       FROM (
         SELECT
           SHA2(COALESCE(PREV_HASH,'') || CASE_REF || DECISION_TYPE || MODEL || PROMPT_HASH || RESPONSE_HASH || COALESCE(CONFIDENCE::STRING,'') || DECIDED_AT::STRING, 256) = ROW_HASH AS row_ok,
           COALESCE(PREV_HASH,'') = COALESCE(LAG(ROW_HASH) OVER (ORDER BY DECIDED_AT, SEQ), '') AS prev_ok
         FROM ${SCHEMA}.FOI_AI_DECISION
       )`,
  ).catch(() => [] as Record<string, unknown>[])
  const chainIntact = chainRows.length ? (n(chainRows[0].N) === 0 || Number(chainRows[0].ALL_OK) === 1) : true

  const rows = await querySnowflake(
    `SELECT SEQ, DECISION_TYPE, MODEL, SF_VERSION, INPUT_TOKENS, OUTPUT_TOKENS, EST_GBP, CONFIDENCE,
            DECISION_SUMMARY, TO_VARCHAR(DECIDED_AT) AS DECIDED_AT, PROMPT_HASH, RESPONSE_HASH
       FROM ${SCHEMA}.FOI_AI_DECISION WHERE CASE_REF = '${esc(reference)}' ORDER BY DECIDED_AT, SEQ`,
  ).catch(() => [] as Record<string, unknown>[])

  const decisions: AiDecisionRecord[] = rows.map((r) => ({
    seq: n(r.SEQ),
    decisionType: String(r.DECISION_TYPE ?? ""),
    model: String(r.MODEL ?? ""),
    sfVersion: String(r.SF_VERSION ?? ""),
    inputTokens: r.INPUT_TOKENS == null ? null : n(r.INPUT_TOKENS),
    outputTokens: r.OUTPUT_TOKENS == null ? null : n(r.OUTPUT_TOKENS),
    estGbp: r.EST_GBP == null ? null : Number(r.EST_GBP),
    confidence: r.CONFIDENCE == null ? null : Number(r.CONFIDENCE),
    summary: String(r.DECISION_SUMMARY ?? ""),
    decidedAt: String(r.DECIDED_AT ?? ""),
    promptHash: String(r.PROMPT_HASH ?? ""),
    responseHash: String(r.RESPONSE_HASH ?? ""),
  }))
  const gbpVals = decisions.map((d) => d.estGbp).filter((x): x is number => x != null)
  return { decisions, chainIntact, totalGbp: gbpVals.length ? gbpVals.reduce((a, b) => a + b, 0) : null }
}

export interface MeasuredAiCost {
  totalCalls: number
  distinctRequests: number
  totalTokens: number
  totalGbp: number
  gbpPerRequest: number | null
  avgLatencyMs: number | null
  lastCallTs: string | null
}

/** Read the live rolling measured-cost summary from FOI_AI_COST_ROLLING. */
export async function getMeasuredAiCost(): Promise<MeasuredAiCost> {
  const rows = await querySnowflake(`SELECT * FROM ${SCHEMA}.FOI_AI_COST_ROLLING`)
  const r = rows[0] ?? {}
  return {
    totalCalls: n(r.TOTAL_CALLS),
    distinctRequests: n(r.DISTINCT_REQUESTS),
    totalTokens: n(r.TOTAL_TOKENS),
    totalGbp: r.TOTAL_GBP == null ? 0 : Number(r.TOTAL_GBP),
    gbpPerRequest: r.GBP_PER_REQUEST == null ? null : Number(r.GBP_PER_REQUEST),
    avgLatencyMs: r.AVG_LATENCY_MS == null ? null : Number(r.AVG_LATENCY_MS),
    lastCallTs: r.LAST_CALL_TS == null ? null : String(r.LAST_CALL_TS),
  }
}

export interface CaseAiCost {
  calls: number
  tokens: number
  gbp: number
  avgLatencyMs: number | null
}

/**
 * Metered AI cost for a single case: every Cortex call logged to FOI_AI_USAGE for
 * this case, summed and costed via the rate card. The real per-response £ shown on
 * the case detail. Returns null when the case has no metered calls yet.
 */
export async function getCaseAiCost(reference: string): Promise<CaseAiCost | null> {
  const rows = await querySnowflake(
    `SELECT COUNT(*) AS CALLS, COALESCE(SUM(INPUT_TOKENS + OUTPUT_TOKENS), 0) AS TOKENS,
            ROUND(COALESCE(SUM(EST_GBP), 0), 4) AS GBP, ROUND(AVG(LATENCY_MS)) AS AVG_LAT
       FROM ${SCHEMA}.FOI_AI_USAGE WHERE CASE_REF = '${esc(reference)}'`,
  ).catch(() => [] as Record<string, unknown>[])
  const r = rows[0]
  if (!r || n(r.CALLS) === 0) return null
  return {
    calls: n(r.CALLS),
    tokens: n(r.TOKENS),
    gbp: Number(r.GBP ?? 0),
    avgLatencyMs: r.AVG_LAT == null ? null : Number(r.AVG_LAT),
  }
}

// Account-wide average manual cost of handling one FOI (triage estimated hours x
// the council's charge-out rate) — the same figure shown on Reporting. Used to
// contrast the metered per-case AI cost against a comparable manual response.
export async function getManualFoiAvgGbp(): Promise<number | null> {
  const rows = await querySnowflake(
    `SELECT ROUND(AVG(TRY_TO_DOUBLE(t.TRIAGE_JSON:estimated_hours::string))
              * COALESCE(TRY_TO_DOUBLE(MAX(cfg.CONFIG_VALUE)), 25), 0) AS AVG_COST
       FROM ${SCHEMA}.FOI_TRIAGE t
       LEFT JOIN ${SCHEMA}.COUNCIL_CONFIG cfg ON cfg.CONFIG_KEY = 'COST_RATE_PER_HOUR'`,
  ).catch(() => [] as Record<string, unknown>[])
  const v = rows[0]?.AVG_COST
  return v == null ? null : Number(v)
}

// ---------------------------------------------------------------------------
// Corpus coverage — the evidence base the pipeline retrieves against. Counts
// are live so the Knowledge Base always reflects real ingested volume, which
// makes the "data delta" honest rather than a static claim.
// ---------------------------------------------------------------------------
export type CorpusGroup = "records" | "logs" | "guidance"

export interface CorpusSubSource {
  label: string
  count: number
  access: string
}

export interface CorpusRow {
  key: string
  label: string
  count: number
  unit: string
  scope: string
  access: string
  internal: boolean
  group: CorpusGroup
  subSources?: CorpusSubSource[]
}

export async function getCorpusCoverage(): Promise<{ rows: CorpusRow[]; wdtkAuthorities: number; total: number }> {
  const counts = await querySnowflake(`
    SELECT 'CAMDEN' AS K, COUNT(*) AS N FROM ${SCHEMA}.CAMDEN_FOI_RESPONSES
    UNION ALL SELECT 'WDTK', COUNT(*) FROM ${SCHEMA}.WDTK_EVENT
    UNION ALL SELECT 'GLA', COUNT(*) FROM ${SCHEMA}.GLA_DISCLOSURE_LOG
    UNION ALL SELECT 'BRENTWOOD', COUNT(*) FROM ${SCHEMA}.BRENTWOOD_FOI_EMBEDDINGS
    UNION ALL SELECT 'POLICY', COUNT(*) FROM ${SCHEMA}.COUNCIL_POLICY_DOCS
    UNION ALL SELECT 'DISCLOSURE', COUNT(*) FROM ${SCHEMA}.DISCLOSURE_LOG
    UNION ALL SELECT 'WDTK_AUTH', COUNT(*) FROM ${SCHEMA}.WDTK_AUTHORITY
    UNION ALL SELECT 'INTERNAL', COUNT(*) FROM ${SCHEMA}.COUNCIL_INTERNAL_HOLDINGS_FACTS
    UNION ALL SELECT 'LEGISLATION', COUNT(*) FROM ${SCHEMA}.FOI_LEGISLATION
    UNION ALL SELECT 'WDTK_BODY', COUNT(*) FROM ${SCHEMA}.WDTK_RESPONSE_BODY
  `)
  const m = new Map<string, number>()
  for (const r of counts) m.set(String(r.K), n(r.N))
  const wdtkAuthorities = m.get("WDTK_AUTH") ?? 0
  const peerParts: CorpusSubSource[] = [
    { label: "Camden disclosure log", count: m.get("CAMDEN") ?? 0, access: "Camden Open Data Store (opendatastore.camden.gov.uk)" },
    { label: "WhatDoTheyKnow precedent", count: m.get("WDTK") ?? 0, access: "whatdotheyknow.com (mySociety), re-used under the OGL" },
    { label: "Greater London Authority", count: m.get("GLA") ?? 0, access: "london.gov.uk published disclosure log" },
    { label: "Brentwood Borough Council", count: m.get("BRENTWOOD") ?? 0, access: "Disclosure-log PDFs, parsed and embedded" },
    { label: "WhatDoTheyKnow real disclosures", count: m.get("WDTK_BODY") ?? 0, access: "WhatDoTheyKnow attachments (mySociety), multimodal-parsed" },
  ].filter((p) => p.count > 0)
  const peerTotal = peerParts.reduce((s, p) => s + p.count, 0)
  const rows: CorpusRow[] = [
    { key: "INTERNAL", label: "This council's own records", count: m.get("INTERNAL") ?? 0, unit: "citable facts", scope: "6 themes — senior pay, supplier/consultancy, temp accommodation, agency staff, HMOs, parking (SYNTHETIC demo data)", access: "Snowflake COUNCIL_* tables the pipeline queries directly", internal: true, group: "records" },
    { key: "DISCLOSURE", label: "This council's own disclosure log", count: m.get("DISCLOSURE") ?? 0, unit: "published answers", scope: "Exampleton's own s.21 already-published register", access: "Internal published register", internal: true, group: "logs" },
    { key: "PEER", label: "Peer disclosure logs", count: peerTotal, unit: "published answers", scope: `Other authorities' published FOI responses across ${wdtkAuthorities}+ councils — used as cross-authority precedent`, access: "Aggregated peer logs, re-used under the Open Government Licence", internal: false, group: "logs", subSources: peerParts },
    { key: "POLICY", label: "Council & ICO guidance", count: m.get("POLICY") ?? 0, unit: "policy docs", scope: "FOI/EIR procedure, ICO guidance, s.45 code of practice", access: "Curated policy corpus", internal: false, group: "guidance" },
    { key: "LEGISLATION", label: "Legislation & Code of Practice", count: m.get("LEGISLATION") ?? 0, unit: "statutory sections", scope: "Freedom of Information Act 2000, EIR 2004 & ICO Code of Practice — exemptions, timescales, cost limits", access: "Cortex Search over FOI_LEGISLATION, grounds the legal basis", internal: false, group: "guidance" },
  ]
  const total = rows.reduce((s, r) => s + r.count, 0)
  return { rows, wdtkAuthorities, total }
}

// ---------------------------------------------------------------------------
// Sector Trends — peer benchmarking from WhatDoTheyKnow + GLA. Ported from
// sector_trends.py. Precedent search uses cortexSearch (above).
// ---------------------------------------------------------------------------

export interface WdtkBenchmarkRow {
  authority: string
  slug: string
  successRate: number
  overdueRate: number
  successRank: number | null
  peerCount: number | null
  peerMedianSuccess: number | null
  peerMedianOverdue: number | null
}

export async function getWdtkBenchmark(): Promise<WdtkBenchmarkRow[]> {
  // Peers come from WhatDoTheyKnow (V_WDTK_BENCHMARK). The home council (Exampleton)
  // is fictional and not in that data, so we compute its real disclosure/overdue rates
  // from our own closed cases and splice it in, ranked among the peers (slug = "home").
  const rows = await querySnowflake(`
    SELECT AUTHORITY_NAME, AUTHORITY_SLUG, SUCCESS_RATE, OVERDUE_RATE
    FROM ${SCHEMA}.V_WDTK_BENCHMARK ORDER BY SUCCESS_RATE DESC
  `)
  const peers: WdtkBenchmarkRow[] = rows.map((r) => ({
    authority: String(r.AUTHORITY_NAME ?? ""),
    slug: String(r.AUTHORITY_SLUG ?? ""),
    successRate: r.SUCCESS_RATE == null ? 0 : Number(r.SUCCESS_RATE),
    overdueRate: r.OVERDUE_RATE == null ? 0 : Number(r.OVERDUE_RATE),
    successRank: null,
    peerCount: null,
    peerMedianSuccess: null,
    peerMedianOverdue: null,
  }))

  const median = (xs: number[]): number | null => {
    if (!xs.length) return null
    const s = [...xs].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }
  const peerMedianSuccess = median(peers.map((p) => p.successRate))
  const peerMedianOverdue = median(peers.map((p) => p.overdueRate))

  const councilName = await getCouncilName()
  const homeStats = await querySnowflake(`
    SELECT SUM(IFF(OUTCOME IN ('GRANTED_FULL','GRANTED_PARTIAL'),1,0))/NULLIF(COUNT(*),0) AS SUCCESS_RATE,
           SUM(IFF(ANSWERED_IN_TIME=FALSE,1,0))/NULLIF(COUNT(*),0) AS OVERDUE_RATE
    FROM ${SCHEMA}.FOI_CASE WHERE STATUS='CLOSED'
  `)
  if (homeStats[0]?.SUCCESS_RATE == null) return peers

  const home: WdtkBenchmarkRow = {
    authority: councilName === "the council" ? "This council" : councilName,
    slug: "home",
    successRate: Number(homeStats[0].SUCCESS_RATE),
    overdueRate: homeStats[0].OVERDUE_RATE == null ? 0 : Number(homeStats[0].OVERDUE_RATE),
    successRank: null,
    peerCount: null,
    peerMedianSuccess,
    peerMedianOverdue,
  }
  const all = [...peers, home].sort((a, b) => b.successRate - a.successRate)
  home.successRank = all.findIndex((r) => r.slug === "home") + 1
  home.peerCount = all.length
  return all
}

export interface ThemeMixRow { theme: string; disclosed: number; refused: number; events: number }

export async function getWdtkThemeMix(): Promise<ThemeMixRow[]> {
  const rows = await querySnowflake(`
    SELECT THEME, EVENTS, DISCLOSED, REFUSED FROM ${SCHEMA}.V_WDTK_THEME_MIX
    ORDER BY EVENTS DESC
  `)
  return rows.map((r) => ({
    theme: String(r.THEME ?? "Other"),
    disclosed: n(r.DISCLOSED),
    refused: n(r.REFUSED),
    events: n(r.EVENTS),
  }))
}

/** Natural-language theme summary of the peer FOI corpus, precomputed with
 * Cortex AI_AGG and cached in WDTK_THEME_SUMMARY (see 01_ddl/11_corpus_summary.sql). */
export async function getWdtkThemeSummary(): Promise<{ text: string; nEvents: number } | null> {
  try {
    const rows = await querySnowflake(`
      SELECT SUMMARY_TEXT, N_EVENTS FROM ${SCHEMA}.WDTK_THEME_SUMMARY LIMIT 1
    `)
    if (!rows.length || !rows[0].SUMMARY_TEXT) return null
    return { text: String(rows[0].SUMMARY_TEXT), nEvents: n(rows[0].N_EVENTS) }
  } catch {
    return null
  }
}

// Refusal reasoning from WhatDoTheyKnow. WDTK_EVENT carries OUTCOME + EXEMPTIONS
// (section codes) + a SNIPPET of the response; we pre-extract a one-line plain-English
// reason (REFUSAL_REASON) and normalised sections (REFUSAL_SECTIONS) via Cortex so the
// sector precedent search can show *why* a comparable request was refused/withheld.

/** Plain-English label for a FOIA/EIR exemption section, for the refusal-drivers panel. */
const EXEMPTION_LABELS: Record<string, string> = {
  "s.12": "Cost of compliance exceeds the limit",
  "s.14": "Vexatious or repeated request",
  "s.21": "Already reasonably accessible",
  "s.22": "Intended for future publication",
  "s.30": "Investigations / proceedings",
  "s.31": "Law enforcement",
  "s.40": "Personal data",
  "s.41": "Information provided in confidence",
  "s.43": "Commercial interests",
}

/**
 * Map WDTK EVENT_IDs to their pre-extracted refusal reason + sections. Used to enrich
 * sector-search precedent hits (EVENT_ID is a returnable Cortex Search attribute).
 */
export async function getWdtkRefusalReasons(
  ids: string[],
): Promise<Record<string, { reason: string; sections: string }>> {
  const clean = [...new Set(ids.map((s) => String(s).trim()).filter((s) => /^\d+$/.test(s)))].slice(0, 30)
  if (!clean.length) return {}
  const rows = await querySnowflake(
    `SELECT EVENT_ID, REFUSAL_REASON, REFUSAL_SECTIONS FROM ${SCHEMA}.WDTK_EVENT WHERE EVENT_ID IN (${clean.join(",")})`,
  )
  const out: Record<string, { reason: string; sections: string }> = {}
  for (const r of rows) {
    out[String(r.EVENT_ID ?? "")] = {
      reason: String(r.REFUSAL_REASON ?? ""),
      sections: String(r.REFUSAL_SECTIONS ?? ""),
    }
  }
  return out
}

export interface RefusalDriver { section: string; label: string; count: number; example: string }

/**
 * The exemption sections most often cited across the sector when requests are refused,
 * partially withheld or not held — each with a representative one-line reason. Counts a
 * row once per distinct section it cites (EXEMPTIONS can list several, e.g. "s12 s43").
 */
export async function getRefusalDrivers(): Promise<RefusalDriver[]> {
  const rows = await querySnowflake(`
    WITH cited AS (
      SELECT e.EVENT_ID, e.REFUSAL_REASON, e.OUTCOME,
             's.' || f.value::string AS SECTION
      FROM ${SCHEMA}.WDTK_EVENT e,
           LATERAL FLATTEN(input => REGEXP_SUBSTR_ALL(COALESCE(e.EXEMPTIONS,''), 's([0-9]+)', 1, 1, 'e', 1)) f
      WHERE e.OUTCOME IN ('Refused','Partially successful','Information not held','Response (unclassified)')
        AND e.REFUSAL_REASON IS NOT NULL
    ),
    ranked AS (
      SELECT SECTION, REFUSAL_REASON,
             COUNT(*) OVER (PARTITION BY SECTION) AS CNT,
             ROW_NUMBER() OVER (
               PARTITION BY SECTION
               ORDER BY CASE WHEN OUTCOME IN ('Refused','Partially successful') THEN 0
                             WHEN OUTCOME = 'Information not held' THEN 1 ELSE 2 END,
                        IFF(REFUSAL_REASON ILIKE '%' || SECTION || '%', 0, 1)
             ) AS RN
      FROM cited
    )
    SELECT SECTION, CNT, REFUSAL_REASON AS EXAMPLE
    FROM ranked WHERE RN = 1
    ORDER BY CNT DESC, SECTION
  `)
  return rows.map((r) => {
    const section = String(r.SECTION ?? "")
    return {
      section,
      label: EXEMPTION_LABELS[section] ?? "Other exemption",
      count: n(r.CNT),
      example: String(r.EXAMPLE ?? ""),
    }
  })
}


export interface GlaSpotlight {
  total: number
  foi: number
  eir: number
  from: string | null
  to: string | null
  recent: { title: string; ref: string; regime: string; date: string | null; url: string }[]
}

export async function getGlaSpotlight(): Promise<GlaSpotlight> {
  const rows = await querySnowflake(`
    SELECT REGIME, TITLE, REFERENCE_NUMBER, RESPONSE_DATE, SOURCE_URL
    FROM ${SCHEMA}.GLA_DISCLOSURE_LOG ORDER BY RESPONSE_DATE DESC NULLS LAST
  `)
  const total = rows.length
  const foi = rows.filter((r) => String(r.REGIME ?? "").toUpperCase() === "FOI").length
  const eir = rows.filter((r) => String(r.REGIME ?? "").toUpperCase() === "EIR").length
  const dates = rows.map((r) => (r.RESPONSE_DATE == null ? null : String(r.RESPONSE_DATE))).filter(Boolean) as string[]
  return {
    total, foi, eir,
    from: dates.length ? dates[dates.length - 1] : null,
    to: dates.length ? dates[0] : null,
    recent: rows.slice(0, 5).map((r) => ({
      title: String(r.TITLE ?? "Untitled"),
      ref: String(r.REFERENCE_NUMBER ?? ""),
      regime: String(r.REGIME ?? ""),
      date: r.RESPONSE_DATE == null ? null : String(r.RESPONSE_DATE),
      url: String(r.SOURCE_URL ?? ""),
    })),
  }
}

// Camden (London Borough) disclosure log — a real borough-level published-response
// corpus (11k+ parsed PDFs), surfaced the same way as the GLA log: a Sector Trends
// spotlight plus inclusion in cross-authority precedent search. Unlike the GLA log,
// the Camden table has no REGIME column, so we derive FOI vs EIR from the response
// text (Camden states which regime it "dealt with this under"); the source PDF link
// lives in DOCUMENT_LINK (it is not a returnable Cortex Search attribute, so search
// hits are enriched via getCamdenLinks()). A small number of rows carry stray dates,
// so the spotlight is floored to recent, valid dates.
const CAMDEN_EIR_MATCH = "DOCUMENT_TEXT ILIKE '%under the Environmental Information Regulations%'"
const CAMDEN_DATE_GUARD = "DOCUMENT_DATE >= '2015-01-01' AND DOCUMENT_DATE <= CURRENT_DATE()"

export interface CamdenSpotlight {
  total: number
  foi: number
  eir: number
  from: string | null
  to: string | null
  recent: { title: string; ref: string; regime: string; date: string | null; url: string }[]
}

export async function getCamdenSpotlight(): Promise<CamdenSpotlight> {
  const [statsRows, recentRows] = await Promise.all([
    querySnowflake(`
      SELECT COUNT(*) AS TOTAL,
             SUM(IFF(${CAMDEN_EIR_MATCH}, 1, 0)) AS EIR,
             SUM(IFF(${CAMDEN_EIR_MATCH}, 0, 1)) AS FOI,
             MIN(DOCUMENT_DATE) AS FROM_DT, MAX(DOCUMENT_DATE) AS TO_DT
      FROM ${SCHEMA}.CAMDEN_FOI_RESPONSES
      WHERE ${CAMDEN_DATE_GUARD}
    `),
    querySnowflake(`
      SELECT IDENTIFIER, DOCUMENT_TITLE, DOCUMENT_DATE, DOCUMENT_LINK,
             IFF(${CAMDEN_EIR_MATCH}, 'EIR', 'FOI') AS REGIME
      FROM ${SCHEMA}.CAMDEN_FOI_RESPONSES
      WHERE ${CAMDEN_DATE_GUARD}
      ORDER BY DOCUMENT_DATE DESC NULLS LAST
      LIMIT 5
    `),
  ])
  const s = statsRows[0] ?? {}
  return {
    total: n(s.TOTAL),
    foi: n(s.FOI),
    eir: n(s.EIR),
    from: s.FROM_DT == null ? null : String(s.FROM_DT),
    to: s.TO_DT == null ? null : String(s.TO_DT),
    recent: recentRows.map((r) => ({
      title: String(r.DOCUMENT_TITLE ?? "Untitled"),
      ref: String(r.IDENTIFIER ?? ""),
      regime: String(r.REGIME ?? ""),
      date: r.DOCUMENT_DATE == null ? null : String(r.DOCUMENT_DATE),
      url: String(r.DOCUMENT_LINK ?? ""),
    })),
  }
}

/**
 * Map Camden IDENTIFIERs to their source PDF link. DOCUMENT_LINK is not a returnable
 * Cortex Search attribute, so Camden search hits are enriched with their real link
 * after the fact. Returns an empty map for an empty/invalid id list.
 */
export async function getCamdenLinks(ids: string[]): Promise<Record<string, string>> {
  const clean = [...new Set(ids.map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]+$/.test(s)))].slice(0, 20)
  if (!clean.length) return {}
  const inList = clean.map((s) => `'${esc(s)}'`).join(",")
  const rows = await querySnowflake(
    `SELECT IDENTIFIER, DOCUMENT_LINK FROM ${SCHEMA}.CAMDEN_FOI_RESPONSES WHERE IDENTIFIER IN (${inList})`,
  )
  return Object.fromEntries(rows.map((r) => [String(r.IDENTIFIER ?? ""), String(r.DOCUMENT_LINK ?? "")]))
}

// ---------------------------------------------------------------------------
// Knowledge & Guidance — the legislation library + multi-corpus Cortex Search
// (handled by /api/search mode=guidance). Ported from guidance.py.
// ---------------------------------------------------------------------------

export interface LegislationRow {
  sectionRef: string
  type: string
  title: string
  summary: string
  publicInterestTest: boolean
}

export async function getLegislation(): Promise<LegislationRow[]> {
  const rows = await querySnowflake(`
    SELECT SECTION_REF, TYPE, TITLE, SUMMARY, PUBLIC_INTEREST_TEST
    FROM ${SCHEMA}.FOI_LEGISLATION
    ORDER BY TYPE, SECTION_REF
  `)
  return rows.map((r) => ({
    sectionRef: String(r.SECTION_REF ?? ""),
    type: String(r.TYPE ?? ""),
    title: String(r.TITLE ?? ""),
    summary: String(r.SUMMARY ?? ""),
    publicInterestTest: r.PUBLIC_INTEREST_TEST === true,
  }))
}

// ---------------------------------------------------------------------------
// Internal Review & ICO + Disclosure log. Ported from review_ico.py /
// escalations.py. Reviews/complaints challenge the original decision; the
// disclosure log publishes closed cases (s.19).
// ---------------------------------------------------------------------------

export interface InternalReview {
  reviewId: string
  reference: string
  regime: string
  subject: string
  requestText: string
  reviewer: string
  originalDecisionBy: string
  reviewDeadline: string | null
  daysLeft: number | null
  outcome: string
  outcomeNote: string
  completedDate: string | null
}

export async function getInternalReviews(): Promise<InternalReview[]> {
  const rows = await querySnowflake(`
    SELECT r.REVIEW_ID, c.REFERENCE, c.REGIME, c.SUBJECT, c.REQUEST_TEXT,
           r.REVIEWER, r.ORIGINAL_DECISION_BY, r.REVIEW_DEADLINE,
           DATEDIFF('day', CURRENT_DATE(), r.REVIEW_DEADLINE) AS DAYS_LEFT,
           r.OUTCOME, r.OUTCOME_NOTE, r.COMPLETED_DATE
    FROM ${SCHEMA}.FOI_INTERNAL_REVIEW r
    JOIN ${SCHEMA}.FOI_CASE c ON c.CASE_ID = r.CASE_ID
    ORDER BY r.REVIEW_DEADLINE
  `)
  return rows.map((r) => ({
    reviewId: String(r.REVIEW_ID ?? ""),
    reference: String(r.REFERENCE ?? ""),
    regime: String(r.REGIME ?? ""),
    subject: String(r.SUBJECT ?? ""),
    requestText: String(r.REQUEST_TEXT ?? ""),
    reviewer: String(r.REVIEWER ?? ""),
    originalDecisionBy: String(r.ORIGINAL_DECISION_BY ?? ""),
    reviewDeadline: r.REVIEW_DEADLINE == null ? null : String(r.REVIEW_DEADLINE),
    daysLeft: r.DAYS_LEFT == null ? null : Number(r.DAYS_LEFT),
    outcome: String(r.OUTCOME ?? ""),
    outcomeNote: String(r.OUTCOME_NOTE ?? ""),
    completedDate: r.COMPLETED_DATE == null ? null : String(r.COMPLETED_DATE),
  }))
}

export interface IcoComplaint {
  complaintId: string
  reference: string
  regime: string
  subject: string
  icoReference: string
  receivedDate: string | null
  status: string
  note: string
  decisionNoticeUrl: string
}

export async function getIcoComplaints(): Promise<IcoComplaint[]> {
  const rows = await querySnowflake(`
    SELECT i.COMPLAINT_ID, c.REFERENCE, c.REGIME, c.SUBJECT, i.ICO_REFERENCE,
           i.RECEIVED_DATE, i.STATUS, i.NOTE, i.DECISION_NOTICE_URL
    FROM ${SCHEMA}.FOI_ICO_COMPLAINT i
    JOIN ${SCHEMA}.FOI_CASE c ON c.CASE_ID = i.CASE_ID
    ORDER BY i.RECEIVED_DATE DESC
  `)
  return rows.map((r) => ({
    complaintId: String(r.COMPLAINT_ID ?? ""),
    reference: String(r.REFERENCE ?? ""),
    regime: String(r.REGIME ?? ""),
    subject: String(r.SUBJECT ?? ""),
    icoReference: String(r.ICO_REFERENCE ?? ""),
    receivedDate: r.RECEIVED_DATE == null ? null : String(r.RECEIVED_DATE),
    status: String(r.STATUS ?? ""),
    note: String(r.NOTE ?? ""),
    decisionNoticeUrl: String(r.DECISION_NOTICE_URL ?? ""),
  }))
}

export interface Publication {
  reference: string
  topic: string
  summary: string
  publicationDate: string | null
  publishedBy: string
}

export async function getDisclosurePublications(): Promise<Publication[]> {
  const rows = await querySnowflake(`
    SELECT REFERENCE_NUMBER, TOPIC, SUMMARY, PUBLICATION_DATE, PUBLISHED_BY
    FROM ${SCHEMA}.FOI_DISCLOSURE_PUBLICATION ORDER BY PUBLICATION_DATE DESC
  `)
  return rows.map((r) => ({
    reference: String(r.REFERENCE_NUMBER ?? ""),
    topic: String(r.TOPIC ?? ""),
    summary: String(r.SUMMARY ?? ""),
    publicationDate: r.PUBLICATION_DATE == null ? null : String(r.PUBLICATION_DATE),
    publishedBy: String(r.PUBLISHED_BY ?? ""),
  }))
}

export async function getIcoBenchmarks(): Promise<{ metric: string; value: number }[]> {
  const rows = await querySnowflake(`
    SELECT METRIC, VALUE FROM ${SCHEMA}.ICO_OUTCOME_BENCHMARK
    WHERE METRIC IN ('internal_review_overturn_rate','internal_review_in_time_rate','ico_complaints_known')
  `)
  return rows.map((r) => ({ metric: String(r.METRIC ?? ""), value: r.VALUE == null ? 0 : Number(r.VALUE) }))
}

export async function getPublishableCases(): Promise<{ reference: string; subject: string }[]> {
  const rows = await querySnowflake(`
    SELECT REFERENCE, SUBJECT FROM ${SCHEMA}.FOI_CASE
    WHERE STATUS='CLOSED' AND COALESCE(IS_PUBLISHED,FALSE)=FALSE
      AND OUTCOME IN ('GRANTED_FULL','GRANTED_PARTIAL')
    ORDER BY CLOSED_DATE DESC
  `)
  return rows.map((r) => ({ reference: String(r.REFERENCE ?? ""), subject: String(r.SUBJECT ?? "") }))
}

const REVIEW_OUTCOMES: Record<string, string> = {
  UPHELD: "original decision upheld",
  PARTIALLY_UPHELD: "original decision partially upheld",
  OVERTURNED: "original decision overturned",
}

/** Record an internal-review outcome with a Cortex-drafted outcome letter. */
export async function recordReviewOutcome(reviewId: string, outcome: string): Promise<{ ok: boolean }> {
  const oc = REVIEW_OUTCOMES[outcome] ? outcome : "UPHELD"
  const rows = await querySnowflake(`
    SELECT r.OUTCOME_NOTE, c.REQUEST_TEXT
    FROM ${SCHEMA}.FOI_INTERNAL_REVIEW r JOIN ${SCHEMA}.FOI_CASE c ON c.CASE_ID = r.CASE_ID
    WHERE r.REVIEW_ID = '${esc(reviewId)}' LIMIT 1
  `)
  if (!rows.length) return { ok: false }
  const grounds = String(rows[0].OUTCOME_NOTE ?? "Not stated")
  const requestText = String(rows[0].REQUEST_TEXT ?? "")
  const prompt =
    "You are a senior FOI officer conducting an internal review. Write a professional outcome letter to the requester. " +
    `Outcome: ${REVIEW_OUTCOMES[oc]}. Reference the review rights and, if not fully resolved, the right to complain to the ICO. ` +
    "Do not invent facts; use [PLACEHOLDER] where case specifics are needed.\n\nORIGINAL REQUEST:\n" + requestText +
    "\n\nREQUESTER'S GROUNDS:\n" + grounds + "\n\nLetter:"
  const draft = await querySnowflakeLongRunning(
    `SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', '${escLit(prompt)}') AS R`,
  )
  const letter = String(draft[0]?.R ?? "").trim()
  await querySnowflake(`
    UPDATE ${SCHEMA}.FOI_INTERNAL_REVIEW
    SET OUTCOME = '${oc}', COMPLETED_DATE = CURRENT_DATE(), OUTCOME_NOTE = '${escLit(letter)}'
    WHERE REVIEW_ID = '${esc(reviewId)}'
  `)
  return { ok: true }
}

export async function updateIcoComplaint(complaintId: string, status: string, url: string): Promise<{ ok: boolean }> {
  const allowed = new Set(["OPEN", "UNDER_INVESTIGATION", "UPHELD", "PARTLY_UPHELD", "NOT_UPHELD"])
  const s = allowed.has(status) ? status : "OPEN"
  await querySnowflake(`
    UPDATE ${SCHEMA}.FOI_ICO_COMPLAINT
    SET STATUS = '${s}', DECISION_NOTICE_URL = '${escLit(url)}'
    WHERE COMPLAINT_ID = '${esc(complaintId)}'
  `)
  return { ok: true }
}

export async function publishCase(reference: string, topic: string): Promise<{ ok: boolean }> {
  const caseId = await caseIdFromRef(reference)
  if (!caseId) return { ok: false }
  await querySnowflake(`
    INSERT INTO ${SCHEMA}.FOI_DISCLOSURE_PUBLICATION (CASE_ID, REFERENCE_NUMBER, PUBLICATION_DATE, TOPIC, SUMMARY, PUBLISHED_BY)
    SELECT CASE_ID, REFERENCE, CURRENT_DATE(), '${escLit(topic)}', LEFT(REQUEST_TEXT, 200), 'FOI Officer'
    FROM ${SCHEMA}.FOI_CASE WHERE REFERENCE = '${esc(reference)}'
  `)
  await querySnowflake(`UPDATE ${SCHEMA}.FOI_CASE SET IS_PUBLISHED = TRUE WHERE REFERENCE = '${esc(reference)}'`)
  return { ok: true }
}

// --- Escalations demo: generate an inbound internal-review / ICO complaint ---

export async function getEscalationCaseOptions(): Promise<{ reference: string; subject: string; status: string }[]> {
  const rows = await querySnowflake(`
    SELECT REFERENCE, SUBJECT, STATUS FROM ${SCHEMA}.FOI_CASE ORDER BY RECEIVED_DATE DESC
  `)
  return rows.map((r) => ({ reference: String(r.REFERENCE ?? ""), subject: String(r.SUBJECT ?? ""), status: String(r.STATUS ?? "") }))
}

export async function createEscalation(
  reference: string,
  type: "review" | "ico",
  note: string,
): Promise<{ ok: boolean }> {
  const caseId = await caseIdFromRef(reference)
  if (!caseId) return { ok: false }
  if (type === "review") {
    await querySnowflake(`
      INSERT INTO ${SCHEMA}.FOI_INTERNAL_REVIEW (CASE_ID, REQUESTED_DATE, ORIGINAL_DECISION_BY, REVIEWER, REVIEW_DEADLINE, OUTCOME, OUTCOME_NOTE)
      SELECT '${esc(caseId)}', CURRENT_DATE(), 'S. Begum', 'D. Marsh (Head of Legal)',
             (SELECT MIN(c2.CAL_DATE) FROM ${SCHEMA}.CALENDAR c2 WHERE c2.IS_WORKING_DAY
              AND c2.WD_INDEX = (SELECT WD_INDEX FROM ${SCHEMA}.CALENDAR WHERE CAL_DATE=CURRENT_DATE()) + 20),
             'PENDING', '${escLit(note)}'
    `)
    await querySnowflake(`CALL ${SCHEMA}.SP_ADVANCE_STAGE('${esc(caseId)}','REVIEW','HUMAN','requester (test)','Internal review requested')`)
  } else {
    const icoRef = `IC-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${reference.slice(-4)}`
    await querySnowflake(`
      INSERT INTO ${SCHEMA}.FOI_ICO_COMPLAINT (CASE_ID, ICO_REFERENCE, RECEIVED_DATE, STATUS, NOTE)
      SELECT '${esc(caseId)}', '${escLit(icoRef)}', CURRENT_DATE(), 'OPEN', '${escLit(note)}'
    `)
    await querySnowflake(`CALL ${SCHEMA}.SP_ADVANCE_STAGE('${esc(caseId)}','REVIEW','HUMAN','requester (test)','ICO complaint lodged')`)
  }
  await querySnowflake(`UPDATE ${SCHEMA}.FOI_CASE SET STATUS = 'OPEN' WHERE CASE_ID = '${esc(caseId)}'`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Admin & Configuration — COUNCIL_CONFIG key/value settings + reference data.
// Ported from admin.py. Triage Learning reads below. 
// ---------------------------------------------------------------------------

export interface ConfigRow { key: string; value: string }

export async function getCouncilConfig(): Promise<ConfigRow[]> {
  const rows = await querySnowflake(`
    SELECT CONFIG_KEY, CONFIG_VALUE FROM ${SCHEMA}.COUNCIL_CONFIG ORDER BY CONFIG_KEY
  `)
  return rows.map((r) => ({ key: String(r.CONFIG_KEY ?? ""), value: String(r.CONFIG_VALUE ?? "") }))
}

export async function updateCouncilConfig(updates: Record<string, string>): Promise<{ ok: boolean }> {
  const keyOk = (k: string) => /^[A-Z0-9_]+$/.test(k)
  for (const [k, v] of Object.entries(updates)) {
    if (!keyOk(k)) continue
    await querySnowflake(
      `UPDATE ${SCHEMA}.COUNCIL_CONFIG SET CONFIG_VALUE = '${escLit(String(v))}' WHERE CONFIG_KEY = '${esc(k)}'`,
    )
  }
  return { ok: true }
}

export async function getAdminReference(): Promise<{
  departments: string[]
  stages: { order: number; name: string; aiAssisted: boolean; humanGated: boolean }[]
  sources: { gla: number; camden: number; wdtkEvents: number; wdtkAuthorities: number }
}> {
  const [dep, stg, gla, camden, wde, wda] = await Promise.all([
    querySnowflake(`SELECT DISTINCT OWNING_DEPARTMENT D FROM ${SCHEMA}.FOI_CASE WHERE OWNING_DEPARTMENT IS NOT NULL ORDER BY 1`),
    querySnowflake(`SELECT STAGE_ORDER, STAGE_NAME, AI_ASSISTED, HUMAN_GATED FROM ${SCHEMA}.LIFECYCLE_STAGE ORDER BY STAGE_ORDER`),
    querySnowflake(`SELECT COUNT(*) N FROM ${SCHEMA}.GLA_DISCLOSURE_LOG`),
    querySnowflake(`SELECT COUNT(*) N FROM ${SCHEMA}.CAMDEN_FOI_RESPONSES`),
    querySnowflake(`SELECT COUNT(*) N FROM ${SCHEMA}.WDTK_EVENT`),
    querySnowflake(`SELECT COUNT(*) N FROM ${SCHEMA}.WDTK_AUTHORITY`),
  ])
  return {
    departments: dep.map((r) => String(r.D ?? "")),
    stages: stg.map((r) => ({ order: n(r.STAGE_ORDER), name: String(r.STAGE_NAME ?? ""), aiAssisted: r.AI_ASSISTED === true, humanGated: r.HUMAN_GATED === true })),
    sources: { gla: n(gla[0]?.N), camden: n(camden[0]?.N), wdtkEvents: n(wde[0]?.N), wdtkAuthorities: n(wda[0]?.N) },
  }
}

// --- Triage Learning ---
export interface TriageLearning {
  routing: { routed: string; n: number; avgConfidence: number | null }[]
  threshold: number
  modelCompare: { model: string; accuracy: number; evalN: number }[]
}

export async function getTriageLearning(): Promise<TriageLearning> {
  const [routing, modelCompare] = await Promise.all([
    querySnowflake(`SELECT ROUTED, COUNT(*) N, AVG(CONFIDENCE) AVG_CONF FROM ${SCHEMA}.FOI_TRIAGE GROUP BY ROUTED`),
    querySnowflake(`SELECT MODEL, ACCURACY, EVAL_N FROM ${SCHEMA}.V_TRIAGE_MODEL_COMPARE ORDER BY ACCURACY`).catch(() => []),
  ])
  let threshold = 0.9
  try {
    const t = await querySnowflake(`SELECT CONFIG_VALUE V FROM ${SCHEMA}.COUNCIL_CONFIG WHERE CONFIG_KEY='AUTO_ACCEPT_THRESHOLD'`)
    const v = Number(t[0]?.V); if (Number.isFinite(v)) threshold = v
  } catch { /* default */ }
  return {
    routing: routing.filter((r) => r.ROUTED != null).map((r) => ({
      routed: String(r.ROUTED ?? ""), n: n(r.N), avgConfidence: r.AVG_CONF == null ? null : Number(r.AVG_CONF),
    })),
    threshold,
    modelCompare: modelCompare.map((r) => ({ model: String(r.MODEL ?? ""), accuracy: r.ACCURACY == null ? 0 : Number(r.ACCURACY), evalN: n(r.EVAL_N) })),
  }
}
