/**
 * Connections & Security registry.
 *
 * Every external connection this app makes, the Snowflake objects that carry it,
 * and the scope each one is granted. Object names and scopes only — no secret
 * values are read or displayed here, and the probe returns status codes rather
 * than mail content.
 */
import { querySnowflake, querySnowflakeLongRunning } from "@/lib/snowflake"
import { SCHEMA, SAR_INGEST_SCHEMA } from "@/lib/constants"

/** LIVE = a real round-trip runs. SIMULATED = the capability is not provisioned. */
export type ConnectionState = "LIVE" | "SIMULATED"

export interface ConnectionSpec {
  id: string
  title: string
  purpose: string
  direction: "Inbound" | "Outbound" | "Bidirectional"
  state: ConnectionState
  /** Why it is simulated, shown only when state is SIMULATED. */
  stateNote?: string
  authModel: string
  /** Snowflake objects that carry the connection, as name + what it is. */
  objects: { name: string; kind: string }[]
  /** Granted permissions. Absent scopes are as important as present ones. */
  scopes: { name: string; granted: boolean }[]
}

export const CONNECTIONS: ConnectionSpec[] = [
  {
    id: "entra",
    title: "Microsoft Entra ID",
    purpose:
      "Issues the app-only access token that authorises every Graph call. No user signs in and no delegated session is held.",
    direction: "Outbound",
    state: "LIVE",
    authModel: "OAuth 2.0 client credentials (app-only), tenant-scoped",
    objects: [
      { name: `${SCHEMA}.OUTLOOK_CLIENT_SECRET`, kind: "Secret (GENERIC_STRING)" },
      { name: "OUTLOOK_GRAPH_EAI", kind: "External access integration" },
      { name: `${SCHEMA}.OUTLOOK_GRAPH_RULE`, kind: "Network rule (egress, 2 hosts)" },
    ],
    scopes: [{ name: "Client credentials grant on the registered application", granted: true }],
  },
  {
    id: "graph",
    title: "Microsoft Graph API",
    purpose:
      "The single API surface used to read the shared FOI mailbox. Snowflake calls it directly from a stored procedure — there is no middleware and no integration server.",
    direction: "Outbound",
    state: "LIVE",
    authModel: "Bearer token from Entra ID, attached per request inside the procedure",
    objects: [
      { name: `${SCHEMA}.SP_PROBE_OUTLOOK`, kind: "Procedure (connectivity probe)" },
      { name: `${SCHEMA}.SP_PEEK_OUTLOOK_INBOX`, kind: "Procedure (read-only peek)" },
      { name: `${SCHEMA}.SP_POLL_OUTLOOK_INBOX`, kind: "Procedure (poll and triage)" },
    ],
    scopes: [
      { name: "Mail.Read", granted: true },
      { name: "Mail.ReadWrite", granted: true },
      { name: "Mail.Send", granted: false },
    ],
  },
  {
    id: "exchange-in",
    title: "Exchange Online — inbound mail",
    purpose:
      "New requests arrive as ordinary email to the shared FOI mailbox. Each message is landed as a case and triaged. This is a genuine round-trip to a real mailbox, not a fixture.",
    direction: "Inbound",
    state: "LIVE",
    authModel: "App-only mailbox access, restricted to the single shared mailbox",
    objects: [
      { name: `${SCHEMA}.SP_POLL_OUTLOOK_INBOX`, kind: "Procedure (Graph read, marks as read)" },
      { name: `${SCHEMA}.FOI_CASE`, kind: "Table (landing target, SOURCE = 'EMAIL')" },
    ],
    scopes: [{ name: "Read and mark-as-read on the shared mailbox", granted: true }],
  },
  {
    id: "exchange-out",
    title: "Exchange Online — outbound dispatch",
    purpose:
      "Dispatching a finished response to the requester. The response text, recipient and audit record are all real; only the send itself is withheld.",
    direction: "Outbound",
    state: "SIMULATED",
    stateNote:
      "Mail.Send is deliberately not granted on this tenant, so no message can leave. Dispatch records the response and its audit trail without transmitting it. Granting Mail.Send is the only change needed to make it live.",
    authModel: "Would reuse the same app-only token; the send permission is not provisioned",
    objects: [{ name: `${SCHEMA}.FOI_RESPONSE`, kind: "Table (dispatch record and audit)" }],
    scopes: [{ name: "Mail.Send", granted: false }],
  },
  {
    id: "sharepoint",
    title: "SharePoint Online — SAR document corpus",
    purpose:
      "Subject access work needs to search documents that live in SharePoint. Snowflake indexes them for search; the documents themselves stay where they are.",
    direction: "Inbound",
    state: "LIVE",
    authModel: "Openflow connector with an app-only registration, scoped to the SAR document library",
    objects: [
      { name: "OPENFLOW_SAR_SHAREPOINT_EAI", kind: "External access integration" },
      { name: `${SAR_INGEST_SCHEMA}.DOCS_CHUNKS`, kind: "Table (extracted text chunks, no file bytes)" },
      { name: `${SAR_INGEST_SCHEMA}.FILE_HASHES`, kind: "Table (content hash, for change detection)" },
      { name: `${SAR_INGEST_SCHEMA}.SAR_SHAREPOINT_DOC_CORPUS`, kind: "Table (subject enrichment)" },
      { name: `${SAR_INGEST_SCHEMA}.SAR_SHAREPOINT_SEARCH`, kind: "Cortex Search service over DOCS_CHUNKS" },
    ],
    scopes: [{ name: "Read on the SAR document library", granted: true }],
  },
]

export interface ProbeResult {
  ok: boolean
  tokenOk: boolean
  tokenStatus: number | null
  graphStatus: number | null
  error?: string
}

/**
 * Live connectivity probe: acquire a token from Entra ID and make one Graph call.
 * Returns status codes only — the procedure also returns the Graph response body,
 * which is deliberately discarded here because it contains mail content.
 */
export async function probeOutlookConnection(): Promise<ProbeResult> {
  try {
    const rows = await querySnowflakeLongRunning(`CALL ${SCHEMA}.SP_PROBE_OUTLOOK()`)
    const raw = rows[0]?.SP_PROBE_OUTLOOK
    const v = (typeof raw === "string" ? JSON.parse(raw) : raw) ?? {}
    const tokenStatus = v.token_status == null ? null : Number(v.token_status)
    const graphStatus = v.graph_status == null ? null : Number(v.graph_status)
    return {
      ok: v.token_ok === true && graphStatus === 200,
      tokenOk: v.token_ok === true,
      tokenStatus,
      graphStatus,
    }
  } catch (e) {
    return {
      ok: false,
      tokenOk: false,
      tokenStatus: null,
      graphStatus: null,
      error: e instanceof Error ? e.message : "Probe failed",
    }
  }
}

export interface ResidencyRow {
  source: string
  holds: string
  mode: "Reference" | "Copy"
  detail: string
}

export interface ResidencyFacts {
  rows: ResidencyRow[]
  /** Live counts of the SharePoint index, so the claim is checkable. */
  sharepointDocs: number | null
  sharepointChunks: number | null
  /** Column list of the index — the evidence that no file content is stored. */
  sharepointColumns: string[]
}

/**
 * Where the data actually sits. The SharePoint figures are read live rather than
 * asserted, because "we hold an index, not a copy" is exactly the claim an
 * information governance reviewer will want to test.
 */
export async function getResidencyFacts(): Promise<ResidencyFacts> {
  let sharepointDocs: number | null = null
  let sharepointChunks: number | null = null
  let sharepointColumns: string[] = []

  try {
    const rows = await querySnowflake(
      `SELECT COUNT(*) AS CHUNKS, COUNT(DISTINCT DOC_ID) AS DOCS FROM ${SAR_INGEST_SCHEMA}.DOCS_CHUNKS`,
    )
    sharepointChunks = rows[0]?.CHUNKS == null ? null : Number(rows[0].CHUNKS)
    sharepointDocs = rows[0]?.DOCS == null ? null : Number(rows[0].DOCS)
  } catch {
    sharepointChunks = null
    sharepointDocs = null
  }

  try {
    const cols = await querySnowflake(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM FOI.INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'SAR_INGEST' AND TABLE_NAME = 'DOCS_CHUNKS'
      ORDER BY ORDINAL_POSITION
    `)
    sharepointColumns = cols
      .map((c) => `${String(c.COLUMN_NAME ?? "")} ${String(c.DATA_TYPE ?? "")}`.trim())
      .filter(Boolean)
  } catch {
    sharepointColumns = []
  }

  return {
    sharepointDocs,
    sharepointChunks,
    sharepointColumns,
    rows: [
      {
        source: "SharePoint document library",
        holds: "Extracted text and metadata for search",
        mode: "Reference",
        detail:
          "SharePoint remains the system of record. The index holds text chunks plus a link back to each source document, and no column of any binary type — so no file is duplicated into Snowflake.",
      },
      {
        source: "Shared FOI mailbox",
        holds: "Request text and sender, as a case",
        mode: "Copy",
        detail:
          "A statutory case file has to be retained independently of the mailbox — the deadline clock, exemption decisions and released response must survive a mailbox being tidied. The message body is therefore copied deliberately.",
      },
      {
        source: "Entra ID application secret",
        holds: "Nothing readable",
        mode: "Reference",
        detail:
          "Held as a Snowflake SECRET object and only ever dereferenced inside a procedure at call time. It cannot be selected, printed or read by the application code, including by this page.",
      },
      {
        source: "Cortex AI processing",
        holds: "No data leaves the account",
        mode: "Reference",
        detail:
          "Triage, drafting and redaction run as SQL functions inside the account. There is no external AI endpoint in the path and no prompt or document is sent to a third-party model provider.",
      },
    ],
  }
}
