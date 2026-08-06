import { UserSearch, ShieldCheck, Layers, Scale, Clock, FileLock2, Inbox, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { getSarData, getSarQueue, getRedactionDemoDoc } from "@/lib/queries"
import { RedactionStudio } from "@/components/redaction/redaction-studio"
import { SarQueue } from "@/components/sar/sar-queue"
import { SarCaseHeader } from "@/components/sar/sar-case-header"

export const dynamic = "force-dynamic"

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
}

const SOURCE_STYLE: Record<string, string> = {
  SharePoint: "var(--brand-primary)",
  Exchange: "var(--brand-primary)",
  FileShare: "var(--warn)",
  SocialCare: "var(--danger)",
  Housing: "var(--ok)",
  Revenues: "var(--ok)",
}

const SOURCE_LABEL: Record<string, string> = {
  SocialCare: "Social Care",
}

function SourceBadge({ source }: { source: string }) {
  const c = SOURCE_STYLE[source] ?? "var(--muted-foreground)"
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: c, backgroundColor: `${c}1a` }}>
      {SOURCE_LABEL[source] ?? source}
    </span>
  )
}

function isMasked(v: string) {
  return v.startsWith("**redacted")
}

function PiiCell({ value }: { value: string }) {
  if (isMasked(value)) {
    return <span className="rounded px-1 text-xs font-medium" style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}>third party (masked)</span>
  }
  return <span className="tabular-nums">{value}</span>
}

function PageTitle() {
  return (
    <div className="flex items-center gap-2">
      <UserSearch className="size-5" style={{ color: "var(--brand-primary)" }} />
      <h1 className="text-2xl font-bold tracking-tight">Subject Access Requests</h1>
    </div>
  )
}

// Generic SAR framing — never names a subject; the deltas an officer must respect vs FOI.
function LegalFraming() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card className="p-4">
        <div className="flex items-center gap-2"><Clock className="size-4" style={{ color: "var(--brand-primary)" }} /><h3 className="text-sm font-semibold">One calendar month</h3></div>
        <p className="mt-1 text-xs text-muted-foreground"><strong>One calendar month</strong> to respond, extendable to three if complex. No s.12 cost limit applies. The clock pauses pending ID or clarification.</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2"><Scale className="size-4" style={{ color: "var(--brand-primary)" }} /><h3 className="text-sm font-semibold">Third-party balancing test</h3></div>
        <p className="mt-1 text-xs text-muted-foreground">Other people&rsquo;s data is redacted unless they consent or disclosure is reasonable. Stricter <strong>serious-harm</strong> rules cover social care, health and education records.</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2"><FileLock2 className="size-4" style={{ color: "var(--brand-primary)" }} /><h3 className="text-sm font-semibold">Plus supplementary info</h3></div>
        <p className="mt-1 text-xs text-muted-foreground"><strong>Article 15</strong> also entitles the requester to the purposes, recipients, retention, source and their rights. Released only once identity is confirmed.</p>
      </Card>
    </div>
  )
}

export default async function SarPage({ searchParams }: { searchParams: Promise<{ case?: string }> }) {
  const sp = await searchParams
  const raw = typeof sp.case === "string" ? sp.case : ""
  const caseRef = /^[A-Za-z0-9-]+$/.test(raw) ? raw : ""
  const queue = await getSarQueue()

  // --- Landing: the SAR queue (no subject named) ---
  if (!caseRef) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-4">
        <PageTitle />
        <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
          A Subject Access Request gives an individual the right to <strong>their own</strong> personal data held anywhere in the council
          (UK GDPR Art 15). Once identity is verified, the task is to find every record about the subject across siloed systems and remove
          <em> third-party</em> data. This is done in <strong>one governed Snowflake platform</strong>: the records, the search, the AI and the redaction, with nothing leaving the platform.
        </p>
        <LegalFraming />
        <Card className="mt-4 p-5">
          <div className="flex items-center gap-2">
            <Inbox className="size-4" style={{ color: "var(--brand-primary)" }} />
            <h2 className="text-base font-semibold">SAR queue</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Requests are held pseudonymised until identity is verified. Open a verified request to reveal the data subject and work it across the estate.
          </p>
          <div className="mt-3"><SarQueue rows={queue} /></div>
        </Card>
      </main>
    )
  }

  // --- Selected case ---
  const [data, redactionDoc] = await Promise.all([getSarData(caseRef), getRedactionDemoDoc()])
  const { subject, findings, sources, working, disclosure, caseMeta } = data

  // Identity not verified for this request -> cannot open the workspace yet.
  if (!subject.identityVerified || !caseMeta) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-4">
        <PageTitle />
        <Card className="mt-4 p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4" style={{ color: "var(--warn-text)" }} />
            <h2 className="text-base font-semibold">Awaiting identity verification</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Request <span className="font-mono">{caseRef}</span>{" "}cannot be opened until the requester&rsquo;s identity is verified. The statutory clock is paused until then.
          </p>
          <Link href="/sar" className="mt-2 inline-block text-sm font-medium text-[var(--brand-primary)] hover:underline">Back to the SAR queue</Link>
        </Card>
        <div className="mt-4"><SarQueue rows={queue} selectedRef={caseRef} /></div>
      </main>
    )
  }

  // --- Verified workspace, scoped to the subject ---
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-4">
      <PageTitle />
      <div className="mt-3"><SarCaseHeader subject={subject} meta={caseMeta} /></div>

      {/* Section 1 — federated search across sources */}
      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2">
          <Layers className="size-4" style={{ color: "var(--brand-primary)" }} />
          <h2 className="text-base font-semibold">1. Find every record about the subject, across all sources</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          One <code className="rounded bg-muted px-1 py-0.5">Cortex Search</code> query spans {sources.length} source systems at once
          ({sources.join(", ")}). Microsoft Purview eDiscovery only reaches M365. This reaches everything ingested.
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2 text-left">Record</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">AI third-party scan</th></tr>
            </thead>
            <tbody>
              {findings.map((f, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2"><SourceBadge source={f.source} /></td>
                  <td className="px-3 py-2">
                    {f.webUrl
                      ? <a href={f.webUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--brand-primary)]">{f.title}</a>
                      : f.title}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{f.date}</td>
                  <td className="px-3 py-2">
                    {/contains third-party/i.test(f.thirdPartyFlag)
                      ? <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ color: "var(--warn-text)", backgroundColor: "var(--warn-bg)" }}>third-party: review</span>
                      : <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ color: "var(--ok)", backgroundColor: "var(--ok-bg)" }}>subject only</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The &ldquo;AI third-party scan&rdquo; is <code className="rounded bg-muted px-1 py-0.5">AI_CLASSIFY</code> run in-database over each document. Here it clears {findings.filter((f) => !/contains third-party/i.test(f.thirdPartyFlag)).length} of {findings.length}{" "}as the subject&rsquo;s own data and flags the rest for a third-party review, so the officer looks only where it matters.
        </p>
      </Card>

      {/* Section 2 — structured records governed in the data layer */}
      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4" style={{ color: "var(--brand-primary)" }} />
          <h2 className="text-base font-semibold">2. Structured records: third-party PII masked in the data layer</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Officer working view of the case-management records. A <strong>conditional masking policy</strong> redacts third-party NI numbers, phones and addresses
          automatically, enforced by Snowflake itself rather than the app, so it holds no matter how the data is queried.
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2 text-left">Person</th><th className="px-3 py-2 text-left">Role</th><th className="px-3 py-2 text-left">NI number</th><th className="px-3 py-2 text-left">Phone</th><th className="px-3 py-2 text-left">Address</th></tr>
            </thead>
            <tbody>
              {working.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2"><SourceBadge source={r.source} /></td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">
                    <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={r.role === "SUBJECT" ? { color: "var(--ok)", backgroundColor: "var(--ok-bg)" } : { color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}>{r.role === "SUBJECT" ? "data subject" : "third party"}</span>
                  </td>
                  <td className="px-3 py-2"><PiiCell value={r.ni} /></td>
                  <td className="px-3 py-2"><PiiCell value={r.phone} /></td>
                  <td className="px-3 py-2"><PiiCell value={r.address} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "var(--ok)" }}>
          <h3 className="text-sm font-semibold">Disclosure bundle: the subject&rsquo;s own records only</h3>
          <p className="mt-1 text-xs text-muted-foreground">A governed view (<code className="rounded bg-muted px-1 py-0.5">V_SAR_DISCLOSURE</code>) returns only {subject.requesterName || "the subject"}&rsquo;s rows. Third-party records are removed at the row level. This is what ships to the requester.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {disclosure.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <SourceBadge source={r.source} />
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">NI {r.ni}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{r.phone}</span>
                <span className="text-xs text-muted-foreground">{r.address}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Section 3 — unstructured redaction, embedded as the worked example */}
      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2">
          <FileLock2 className="size-4" style={{ color: "var(--brand-primary)" }} />
          <h2 className="text-base font-semibold">3. Redact the actual document held about {subject.requesterName || "the subject"}</h2>
        </div>
        <p className="mt-1 max-w-4xl text-xs text-muted-foreground">
          The same SAR, taken to the document itself. Cortex <code className="rounded bg-muted px-1 py-0.5">AI_PARSE_DOCUMENT</code> + <code className="rounded bg-muted px-1 py-0.5">AI_EXTRACT</code> detect
          third-party PII selectively, keeping {subject.requesterName || "the requester"}&rsquo;s own data and removing everyone else&rsquo;s, with confidence scores and human sign-off. AI suggests, and the officer decides and releases.
        </p>
        <RedactionStudio doc={redactionDoc} />
      </Card>

      {/* Section 4 — what only Snowflake does */}
      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">Why this is a Snowflake story</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">One governed platform</p>
            <p className="mt-1 text-xs text-muted-foreground">Unstructured documents + structured case records + search + AI + governance + audit in one place. No copying data into a separate eDiscovery or redaction tool.</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">AI runs where the data lives</p>
            <p className="mt-1 text-xs text-muted-foreground"><code className="rounded bg-muted px-1 py-0.5">AI_CLASSIFY</code>, <code className="rounded bg-muted px-1 py-0.5">AI_EXTRACT</code> and Cortex Search execute in-database, so personal data never leaves Snowflake for inference (and can be pinned to EU regions).</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Governance in the data layer</p>
            <p className="mt-1 text-xs text-muted-foreground">Masking &amp; row-access policies enforce the SAR third-party rule at the source, not in application code that can be bypassed.</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Beyond Purview</p>
            <p className="mt-1 text-xs text-muted-foreground">Microsoft Purview eDiscovery is M365-only with no redaction and no third-party detection. This reaches social care, housing and revenues too, and does the first-pass review.</p>
          </div>
        </div>
        <p className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          The documents above are <strong>live</strong>, ingested from SharePoint by the{" "}
          <strong>Openflow SharePoint connector</strong>{" "}into a Snowflake Cortex Search service. The structured records
          below are synthetic. Per-SAR Cortex cost is metered exactly like FOI (see Reporting &amp; Cost).
        </p>
      </Card>
    </main>
  )
}
