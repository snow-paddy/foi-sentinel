import { ShieldCheck, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Check, X, Database, Link2 } from "lucide-react"
import { CONNECTIONS, getResidencyFacts, type ConnectionSpec } from "@/lib/connections"
import { ProbeButton } from "@/components/connections/probe-button"

export const dynamic = "force-dynamic"

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
}

function StateBadge({ state }: { state: ConnectionSpec["state"] }) {
  const live = state === "LIVE"
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        backgroundColor: live ? "var(--ok-bg)" : "var(--warn-bg)",
        color: live ? "var(--ok)" : "var(--warn-text)",
      }}
    >
      {state}
    </span>
  )
}

function DirectionIcon({ direction }: { direction: ConnectionSpec["direction"] }) {
  const Icon = direction === "Inbound" ? ArrowDownToLine : direction === "Outbound" ? ArrowUpFromLine : ArrowLeftRight
  return <Icon className="size-3.5" />
}

function ConnectionCard({ c }: { c: ConnectionSpec }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{c.title}</h2>
        <StateBadge state={c.state} />
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <DirectionIcon direction={c.direction} /> {c.direction}
        </span>
      </div>

      <p className="mt-1.5 text-sm text-muted-foreground">{c.purpose}</p>

      {c.stateNote && (
        <p className="mt-2 rounded-lg border border-border bg-muted/20 p-2.5 text-xs text-foreground/90">{c.stateNote}</p>
      )}

      <p className="mt-3 text-xs">
        <span className="text-muted-foreground">Authentication: </span>
        <span className="font-medium">{c.authModel}</span>
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Snowflake objects</p>
          <ul className="mt-1.5 space-y-1">
            {c.objects.map((o) => (
              <li key={o.name} className="text-xs">
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{o.name}</code>
                <span className="ml-1.5 text-muted-foreground">{o.kind}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Permissions</p>
          <ul className="mt-1.5 space-y-1">
            {c.scopes.map((s) => (
              <li key={s.name} className="flex items-start gap-1.5 text-xs">
                {s.granted ? (
                  <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--ok)" }} />
                ) : (
                  <X className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--danger)" }} />
                )}
                <span className={s.granted ? "" : "text-muted-foreground"}>
                  {s.name}
                  {!s.granted && <span className="ml-1 font-medium" style={{ color: "var(--danger)" }}>not granted</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}

export default async function ConnectionsPage() {
  const residency = await getResidencyFacts()

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5" style={{ color: "var(--brand-primary)" }} />
        <h1 className="text-2xl font-bold tracking-tight">Connections &amp; Security</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every external system this service talks to, the Snowflake object that carries the connection, and the exact
        permission it holds. Object names and scopes are shown; no secret value is read or displayed, including by this page.
      </p>

      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">Verify it yourself</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing on this page is a static claim about connectivity. Run the probe and it performs the real exchange.
        </p>
        <div className="mt-3">
          <ProbeButton />
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4">
        {CONNECTIONS.map((c) => (
          <ConnectionCard key={c.id} c={c} />
        ))}
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2">
          <Database className="size-4" style={{ color: "var(--brand-primary)" }} />
          <h2 className="text-base font-semibold">Where your data actually sits</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          The distinction that matters to an information governance review: what is referenced in place, and what is
          genuinely copied — with the reason it has to be.
        </p>

        <div className="mt-3 space-y-2.5">
          {residency.rows.map((r) => (
            <div key={r.source} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{r.source}</p>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: r.mode === "Reference" ? "var(--ok-bg)" : "var(--warn-bg)",
                    color: r.mode === "Reference" ? "var(--ok)" : "var(--warn-text)",
                  }}
                >
                  {r.mode}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{r.holds}</span>
              </div>
              <p className="mt-1.5 text-xs text-foreground/90">{r.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Link2 className="size-3.5" /> The SharePoint index, read live
          </p>
          <p className="mt-1.5 text-sm">
            {residency.sharepointChunks == null || residency.sharepointDocs == null ? (
              <span className="text-muted-foreground">The index could not be read.</span>
            ) : (
              <>
                <span className="tnum font-semibold">{residency.sharepointChunks.toLocaleString()}</span> text chunk
                {residency.sharepointChunks === 1 ? "" : "s"} across{" "}
                <span className="tnum font-semibold">{residency.sharepointDocs.toLocaleString()}</span> document
                {residency.sharepointDocs === 1 ? "" : "s"}.
              </>
            )}
          </p>
          {residency.sharepointColumns.length > 0 && (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                Every column of the index, so you can see there is nowhere for file content to be stored:
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {residency.sharepointColumns.map((col) => (
                  <li key={col} className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                    <code>{col}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Card>
    </main>
  )
}
