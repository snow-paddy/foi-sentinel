"use client"

import { useMemo, useState } from "react"
import { Loader2, ShieldCheck, Play, ChevronDown, FileText, Eye, Lock, Sparkles } from "lucide-react"
import type { RedactionDemoDoc, RedactionDemoResult, RedactionFinding } from "@/lib/queries"
import { runJob } from "@/lib/job-client"

const CATEGORY_LABEL: Record<string, string> = {
  NAME: "Name",
  PHONE: "Phone",
  EMAIL: "Email",
  ADDRESS: "Address",
}

function confidenceStyle(score: number | null): { bg: string; fg: string; label: string } {
  if (score == null) return { bg: "var(--muted)", fg: "var(--muted-foreground)", label: "n/a" }
  const pct = `${Math.round(score * 100)}%`
  if (score >= 0.6) return { bg: "var(--ok-bg)", fg: "var(--ok)", label: pct }
  if (score >= 0.45) return { bg: "var(--warn-bg)", fg: "var(--warn)", label: pct }
  return { bg: "var(--danger-bg)", fg: "var(--danger)", label: pct }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Recompute the released document from the officer's accepted (redact) findings.
 *  Mirrors the server logic: address fragments split on commas, longest needle first. */
function buildReleased(parsedText: string, findings: RedactionFinding[], redact: boolean[]): string {
  const targets: { needle: string; label: string }[] = []
  findings.forEach((f, i) => {
    if (!redact[i]) return
    targets.push({ needle: f.value, label: f.category })
    if (f.category === "ADDRESS") {
      for (const frag of f.value.split(",")) {
        const t = frag.trim()
        if (t.length >= 4) targets.push({ needle: t, label: "ADDRESS" })
      }
    }
  })
  targets.sort((a, b) => b.needle.length - a.needle.length)
  let out = parsedText
  for (const t of targets) {
    out = out.replace(new RegExp(escapeRegExp(t.needle), "gi"), `[${t.label} REDACTED]`)
  }
  return out
}

/** Default decision for a fresh finding: honour a prior officer decision, else redact when confident. */
function defaultRedact(f: RedactionFinding): boolean {
  if (f.prior === "KEEP") return false
  if (f.prior === "REDACT") return true
  return (f.confidence ?? 0) >= 0.45
}

function RedactedDoc({ text }: { text: string }) {
  const parts = text.split(/(\[[A-Z]+ REDACTED\])/g)
  return (
    <div className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
      {parts.map((p, i) =>
        /^\[[A-Z]+ REDACTED\]$/.test(p) ? (
          <span
            key={i}
            className="mx-0.5 rounded-sm px-1 align-baseline text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: "#111", color: "#fff" }}
          >
            {p.replace(/[[\]]/g, "")}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </div>
  )
}

export function RedactionStudio({ doc }: { doc: RedactionDemoDoc }) {
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<RedactionDemoResult | null>(null)
  const [decisions, setDecisions] = useState<boolean[]>([]) // true = redact
  const [released, setReleased] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSql, setShowSql] = useState(false)

  async function run() {
    setRunning(true)
    setError(null)
    setReleased(false)
    try {
      // Submitted as a job and polled: a cold run parses the PDF and then extracts
      // from it, which takes minutes — far past the 90-second SPCS ingress limit.
      const result = await runJob<RedactionDemoResult>("/api/redaction/demo/run")
      setResult(result)
      setDecisions(result.findings.map(defaultRedact))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Redaction failed")
    } finally {
      setRunning(false)
    }
  }

  async function release() {
    if (!result) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        docKey: result.docKey,
        decisions: result.findings.map((f, i) => ({
          category: f.category,
          value: f.value,
          confidence: f.confidence,
          action: decisions[i] ? "REDACT" : "KEEP",
        })),
      }
      const res = await fetch("/api/redaction/demo/release", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) throw new Error(data.error ?? "Release failed")
      setReleased(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Release failed")
    } finally {
      setSaving(false)
    }
  }

  const releasedText = useMemo(
    () => (result ? buildReleased(result.parsedText, result.findings, decisions) : ""),
    [result, decisions],
  )
  const nRedact = decisions.filter(Boolean).length
  const nKeptThirdParty = decisions.length - nRedact

  return (
    <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* LEFT — source document */}
      <section className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <FileText className="size-4" style={{ color: "var(--brand-primary)" }} />
          <div>
            <h2 className="text-sm font-semibold">Source document, held by the council</h2>
            <p className="text-xs text-muted-foreground">{doc.title}</p>
          </div>
        </header>
        <div className="p-3">
          <div className="mb-2 rounded-md border px-3 py-2 text-[11px]" style={{ backgroundColor: "var(--warn-bg)", borderColor: "var(--warn)", color: "var(--warn-text)" }}>
            Synthetic training document, fabricated personal data for demonstration only.
          </div>
          <object data="/api/redaction/demo/pdf" type="application/pdf" className="h-[640px] w-full rounded-md border border-border bg-white">
            <iframe src="/api/redaction/demo/pdf" title="Source PDF" className="h-[640px] w-full rounded-md border border-border" />
          </object>
          <a
            href="/api/redaction/demo/pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <FileText className="size-3.5" /> Open the PDF in a new tab
          </a>
        </div>
      </section>

      {/* RIGHT — AI redaction */}
      <section className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" style={{ color: "var(--brand-primary)" }} />
            <div>
              <h2 className="text-sm font-semibold">Snowflake AI redaction</h2>
              <p className="text-xs text-muted-foreground">
                Cortex <code className="rounded bg-muted px-1 text-[10px]">AI_EXTRACT</code>: AI suggests, the officer decides
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {running ? "Redacting…" : result ? "Re-run" : "Run AI redaction"}
          </button>
        </header>

        <div className="p-4">
          {error && (
            <div className="rounded-md border px-3 py-2 text-xs" style={{ backgroundColor: "var(--danger-bg)", borderColor: "var(--danger)", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          {!result && !error && (
            <div className="flex h-[560px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Eye className="mb-2 size-6 opacity-40" />
              <p className="max-w-xs">
                Run the AI to detect third-party personal data. Each item is a suggestion: keep the
                requester&rsquo;s own data, redact third parties, then release. The tool remembers your decisions and pre-applies them next time.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md px-2 py-1 font-medium" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
                  {nRedact} third-party item{nRedact === 1 ? "" : "s"} to redact
                </span>
                <span className="rounded-md px-2 py-1 font-medium" style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}>
                  {result.kept.length} of {result.requesterName}&rsquo;s own detail{result.kept.length === 1 ? "" : "s"} kept
                </span>
                {nKeptThirdParty > 0 && (
                  <span className="rounded-md px-2 py-1 font-medium" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
                    {nKeptThirdParty} suggestion{nKeptThirdParty === 1 ? "" : "s"} overridden
                  </span>
                )}
                {result.learnedCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium" style={{ backgroundColor: "var(--brand-primary)", color: "#fff" }}>
                    <Sparkles className="size-3" /> Learned from {result.learnedCount} prior decision{result.learnedCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {/* Findings — each is an officer decision */}
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detected personal data: tick to redact (third party), untick to keep
                </h3>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {result.findings.map((f: RedactionFinding, i: number) => {
                    const c = confidenceStyle(f.confidence)
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={decisions[i] ?? false}
                            onChange={(e) => setDecisions((d) => d.map((v, j) => (j === i ? e.target.checked : v)))}
                            className="size-3.5 shrink-0 accent-[var(--brand-primary)]"
                            aria-label={`Redact ${f.value}`}
                          />
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ backgroundColor: "var(--muted)", color: "var(--brand-primary)" }}>
                            {CATEGORY_LABEL[f.category] ?? f.category}
                          </span>
                          <span className="truncate font-mono text-xs">{f.value}</span>
                          {f.prior && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "var(--brand-primary)", color: "#fff" }} title="Applied from your previous decision">
                              <Sparkles className="size-2.5" /> {f.prior === "KEEP" ? "kept last time" : "redacted last time"}
                            </span>
                          )}
                          {!f.located && (
                            <span className="shrink-0 text-[10px] italic text-muted-foreground">(not in text layer)</span>
                          )}
                        </div>
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums" style={{ backgroundColor: c.bg, color: c.fg }} title="Detection strength">
                          {c.label}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Redacted document */}
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Released document (your redactions applied)
                </h3>
                <div className="max-h-[640px] overflow-auto rounded-md border border-border bg-muted/40 p-3">
                  <RedactedDoc text={releasedText} />
                </div>
              </div>

              {/* Confirm & release */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={release}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                  Confirm &amp; release ({nRedact} of {result.findings.length} redacted)
                </button>
                {released && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
                    <Lock className="size-3" /> Released &middot; decisions saved. Re-run to see them applied.
                  </span>
                )}
              </div>

              {/* AI SQL */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowSql((s) => !s)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className={`size-3.5 transition-transform ${showSql ? "rotate-180" : ""}`} />
                  The AI SQL behind this
                </button>
                {showSql && (
                  <div className="mt-2 space-y-2">
                    <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">{result.sql.parse}</pre>
                    <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">{result.sql.extract}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
