"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Loader2, Lock, Search } from "lucide-react"
import type { SarDoc, RedactSpan } from "@/lib/queries"

/**
 * SAR third-party redaction (s.40 / DPA 2018). AI detects personal data; the
 * human keeps the requester's own data and redacts third parties, then releases
 * the bundle. Released text is built by text-replacement (longest match first,
 * de-duplicated) so multibyte characters never shift offsets.
 */
export function SarRedactionPanel({ reference, docs }: { reference: string; docs: SarDoc[] }) {
  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <ShieldCheck className="size-4" style={{ color: "var(--brand-primary)" }} />
        <h2 className="text-base font-semibold">SAR redaction</h2>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-xs text-muted-foreground">
          Subject Access Request: the requester receives their own personal data, but{" "}
          <span className="font-medium text-foreground">third-party personal data must be removed</span>{" "}
          (s.40 / DPA 2018). Cortex AI_REDACT detects the personal data; a human verifies each item:
          keep the requester&rsquo;s own, redact third parties, before release.
        </p>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No internal documents attached to this SAR.</p>
        ) : (
          docs.map((d) => <DocRedactor key={d.docId} reference={reference} doc={d} />)
        )}
      </div>
    </div>
  )
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Original document with detected personal data highlighted: red = flagged to
 *  redact (third party), green = kept (the requester's own data). Updates live. */
function HighlightedOriginal({ text, spans, flags }: { text: string; spans: RedactSpan[]; flags: boolean[] }) {
  const byText = new Map<string, boolean>()
  spans.forEach((sp, i) => {
    if (!sp.text) return
    byText.set(sp.text, (byText.get(sp.text) ?? false) || (flags[i] ?? true))
  })
  const unique = [...byText.keys()].sort((a, b) => b.length - a.length)
  if (unique.length === 0) return <>{text}</>
  const parts = text.split(new RegExp(`(${unique.map(escapeRegExp).join("|")})`, "g"))
  return (
    <>
      {parts.map((p, i) =>
        byText.has(p) ? (
          <mark key={i} className="rounded px-0.5 font-medium"
                style={byText.get(p)
                  ? { background: "var(--danger-bg)", color: "var(--danger)" }
                  : { background: "var(--ok-bg)", color: "var(--ok)" }}>
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

/** Released text with [CATEGORY] redaction tags highlighted as blackout. */
function HighlightedReleased({ text }: { text: string }) {
  const parts = text.split(/(\[[A-Z_ ]+\])/g)
  return (
    <>
      {parts.map((p, i) =>
        /^\[[A-Z_ ]+\]$/.test(p) ? (
          <mark key={i} className="rounded px-1 font-bold" style={{ background: "var(--foreground)", color: "var(--card)" }}>{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

function DocRedactor({ reference, doc }: { reference: string; doc: SarDoc }) {
  const router = useRouter()
  const [spans, setSpans] = useState<RedactSpan[] | null>(null)
  const [flags, setFlags] = useState<boolean[]>([])
  const [busy, setBusy] = useState<"detect" | "release" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [released, setReleased] = useState<{ total: number; redacted: number } | null>(
    doc.spansTotal != null && doc.spansRedacted != null
      ? { total: doc.spansTotal, redacted: doc.spansRedacted }
      : null,
  )

  async function detect() {
    setBusy("detect"); setError(null)
    try {
      const res = await fetch("/api/sar/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docId: doc.docId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed")
      const found = (data.spans ?? []) as RedactSpan[]
      setSpans(found)
      setFlags(found.map((s) => s.prior !== "KEEP")) // default redact, unless kept before
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detection failed")
    } finally {
      setBusy(null)
    }
  }

  // Build released text: replace each FLAGGED span's text (longest first, deduped)
  // with its [CATEGORY] tag. Text-replacement avoids index drift from multibyte chars.
  const releasedText = useMemo(() => {
    if (!spans) return doc.text
    let out = doc.text
    const toRedact = spans
      .map((sp, i) => ({ ...sp, on: flags[i] }))
      .filter((s) => s.on && s.text)
      .sort((a, b) => b.text.length - a.text.length)
    const seen = new Set<string>()
    for (const s of toRedact) {
      if (seen.has(s.text)) continue
      seen.add(s.text)
      out = out.split(s.text).join(`[${s.category}]`)
    }
    return out
  }, [spans, flags, doc.text])

  const nRedact = flags.filter(Boolean).length

  async function release() {
    if (!spans) return
    setBusy("release"); setError(null)
    try {
      const res = await fetch("/api/sar/release", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reference,
          docId: doc.docId,
          releasedText,
          spansTotal: spans.length,
          spansRedacted: nRedact,
          decisions: spans.map((sp, i) => ({
            category: sp.category,
            value: sp.text,
            action: flags[i] ? "REDACT" : "KEEP",
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed")
      setReleased({ total: spans.length, redacted: nRedact })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Release failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{doc.title}</span>
        {released && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
            <Lock className="size-3" /> Released · {released.redacted}/{released.total} redacted
          </span>
        )}
      </div>

      {spans == null ? (
        <button
          type="button"
          disabled={busy != null}
          onClick={detect}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-60"
        >
          {busy === "detect" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Detect personal data (AI)
        </button>
      ) : spans.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: "var(--ok)" }}>No personal data detected.</p>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-muted-foreground">
            {spans.length} item(s) detected. Tick to <span className="font-medium text-foreground">redact</span>{" "}
            (third parties); untick to keep (the requester&rsquo;s own data). Every decision is the human&rsquo;s.
          </p>
          {spans.some((s) => s.prior) && (
            <p className="text-[11px] font-medium" style={{ color: "var(--brand-primary)" }}>
              Learned from {spans.filter((s) => s.prior).length} prior decision(s), pre-applied below.
            </p>
          )}
          <ul className="space-y-1">
            {spans.map((sp, i) => (
              <li key={`${sp.text}-${i}`} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={flags[i] ?? true}
                  onChange={(e) => setFlags((f) => f.map((v, j) => (j === i ? e.target.checked : v)))}
                  className="size-3.5 accent-[var(--brand-primary)]"
                />
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded px-1 py-0.5 text-[10px] font-bold"
                        style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{sp.category}</span>
                  <span className="font-mono text-xs">{sp.text}</span>
                  {sp.prior && (
                    <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium" style={{ background: "var(--brand-primary)", color: "#fff" }} title="Applied from your previous decision">
                      {sp.prior === "KEEP" ? "kept last time" : "redacted last time"}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)" }} /> Will be redacted (third party)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm" style={{ background: "var(--ok-bg)", border: "1px solid var(--ok)" }} /> Kept (requester&rsquo;s own)
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Before · original document <span className="font-normal normal-case">(internal: AI-detected data highlighted)</span>
              </p>
              <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-2 text-xs leading-relaxed">
                <HighlightedOriginal text={doc.text} spans={spans} flags={flags} />
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                After · released to requester <span className="font-normal normal-case">(third parties blacked out)</span>
              </p>
              <div className="whitespace-pre-wrap rounded-md border p-2 text-xs leading-relaxed"
                   style={{ background: "var(--ok-bg)", borderColor: "var(--ok)" }}>
                <HighlightedReleased text={releasedText} />
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={busy != null}
            onClick={release}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--brand-primary)" }}
          >
            {busy === "release" ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            Release bundle ({nRedact} of {spans.length} redacted)
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  )
}
