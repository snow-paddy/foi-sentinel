"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Scale, FileWarning, BookOpen } from "lucide-react"
import type { InternalReview, IcoComplaint, Publication } from "@/lib/queries"

async function post(body: unknown): Promise<void> {
  const res = await fetch("/api/review", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || "Failed")
}
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Failed")
const fmt = (d: string | null) => (!d ? "—" : new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }))

function deadlineBadge(daysLeft: number | null, completed: boolean) {
  if (completed) return { label: "Completed", bg: "var(--ok-bg)", fg: "var(--ok)" }
  if (daysLeft == null) return { label: "—", bg: "var(--muted)", fg: "var(--muted-foreground)" }
  if (daysLeft < 0) return { label: `${Math.abs(daysLeft)}d overdue`, bg: "var(--danger-bg)", fg: "var(--danger)" }
  if (daysLeft <= 5) return { label: `${daysLeft}d left`, bg: "var(--warn-bg)", fg: "var(--warn)" }
  return { label: `${daysLeft}d left`, bg: "var(--ok-bg)", fg: "var(--ok)" }
}

const TABS = [
  { id: "reviews", label: "Internal reviews", icon: Scale },
  { id: "ico", label: "ICO complaints", icon: FileWarning },
  { id: "log", label: "Disclosure log", icon: BookOpen },
] as const

export function ReviewWorkspace({
  reviews, complaints, publications, benchmarks, publishable,
}: {
  reviews: InternalReview[]
  complaints: IcoComplaint[]
  publications: Publication[]
  benchmarks: { metric: string; value: number }[]
  publishable: { reference: string; subject: string }[]
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("reviews")
  const bm = Object.fromEntries(benchmarks.map((b) => [b.metric, b.value]))

  return (
    <div>
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className="inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium"
                  style={tab === t.id ? { borderColor: "var(--brand-primary)", color: "var(--brand-primary)" } : { borderColor: "transparent", color: "var(--muted-foreground)" }}>
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "reviews" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sector benchmarks: {Math.round((bm.internal_review_overturn_rate ?? 0) * 100)}% overturned · {Math.round((bm.internal_review_in_time_rate ?? 0) * 100)}% in time · {Math.round(bm.ico_complaints_known ?? 0)} ICO complaints known.
            </p>
            {reviews.length === 0
              ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No internal reviews open. When a requester challenges a decision, the review lands here with an AI-drafted outcome letter ready for an officer to confirm (uphold, partially uphold or overturn).</p>
              : reviews.map((r) => <ReviewCard key={r.reviewId} review={r} />)}
          </div>
        )}
        {tab === "ico" && (
          <div className="space-y-3">
            {complaints.length === 0
              ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No ICO complaints. If a requester escalates to the Information Commissioner under s.50, the complaint is tracked here through to the decision notice.</p>
              : complaints.map((c) => <ComplaintCard key={c.complaintId} complaint={c} />)}
          </div>
        )}
        {tab === "log" && <DisclosureLog publications={publications} publishable={publishable} />}
      </div>
    </div>
  )
}

function ReviewCard({ review }: { review: InternalReview }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const completed = review.outcome.toUpperCase() !== "PENDING" && review.completedDate != null
  const badge = deadlineBadge(review.daysLeft, completed)

  async function decide(outcome: string) {
    setBusy(outcome); setError(null)
    try { await post({ action: "review-outcome", reviewId: review.reviewId, outcome }); router.refresh() }
    catch (e) { setError(errMsg(e)) } finally { setBusy(null) }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{review.regime}</span>
        <span className="font-mono text-xs font-semibold">{review.reference}</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
      </div>
      <p className="mt-1 text-sm font-medium">{review.subject}</p>
      <p className="text-xs text-muted-foreground">Original decision: {review.originalDecisionBy || "—"} · Reviewer: {review.reviewer || "—"} · Deadline {fmt(review.reviewDeadline)}</p>
      {completed ? (
        <div className="mt-2">
          <p className="text-xs font-semibold" style={{ color: "var(--ok)" }}>Outcome: {review.outcome}</p>
          <textarea readOnly value={review.outcomeNote} rows={5} className="mt-1 w-full rounded-md border border-border bg-muted/20 p-2 text-xs" />
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={busy != null} onClick={() => decide("UPHELD")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-60">
            {busy === "UPHELD" ? <Loader2 className="size-3.5 animate-spin" /> : null} Uphold
          </button>
          <button type="button" disabled={busy != null} onClick={() => decide("PARTIALLY_UPHELD")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-60">
            {busy === "PARTIALLY_UPHELD" ? <Loader2 className="size-3.5 animate-spin" /> : null} Partially uphold
          </button>
          <button type="button" disabled={busy != null} onClick={() => decide("OVERTURNED")}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "var(--brand-primary)" }}>
            {busy === "OVERTURNED" ? <Loader2 className="size-3.5 animate-spin" /> : null} Overturn
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  )
}

const ICO_STATUSES = ["OPEN", "UNDER_INVESTIGATION", "UPHELD", "PARTLY_UPHELD", "NOT_UPHELD"]

function ComplaintCard({ complaint }: { complaint: IcoComplaint }) {
  const router = useRouter()
  const [status, setStatus] = useState(complaint.status || "OPEN")
  const [url, setUrl] = useState(complaint.decisionNoticeUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setError(null)
    try { await post({ action: "ico-update", complaintId: complaint.complaintId, status, url }); router.refresh() }
    catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold">{complaint.reference}</span>
        <span className="text-xs text-muted-foreground">ICO {complaint.icoReference} · {fmt(complaint.receivedDate)}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{complaint.status}</span>
      </div>
      <p className="mt-1 text-sm font-medium">{complaint.subject}</p>
      {complaint.note && <p className="text-xs text-muted-foreground">{complaint.note}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
          {ICO_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Decision notice URL"
               className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs" />
        <button type="button" disabled={busy} onClick={save}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "var(--brand-primary)" }}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Record decision
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  )
}

function DisclosureLog({ publications, publishable }: { publications: Publication[]; publishable: { reference: string; subject: string }[] }) {
  const router = useRouter()
  const [ref, setRef] = useState(publishable[0]?.reference ?? "")
  const [topic, setTopic] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function publish() {
    if (!ref || !topic.trim()) return
    setBusy(true); setError(null)
    try { await post({ action: "publish", reference: ref, topic }); setTopic(""); router.refresh() }
    catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border p-3">
        <p className="text-sm font-semibold">Publish a closed case (s.19)</p>
        {publishable.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">No eligible closed cases to publish.</p> : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={ref} onChange={(e) => setRef(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
              {publishable.map((p) => <option key={p.reference} value={p.reference}>{p.reference}: {p.subject.slice(0, 40)}</option>)}
            </select>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic"
                   className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs" />
            <button type="button" disabled={busy} onClick={publish}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "var(--brand-primary)" }}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Publish
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-xs font-medium" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="py-2 font-semibold">Date</th><th className="py-2 font-semibold">Reference</th><th className="py-2 font-semibold">Topic</th>
        </tr></thead>
        <tbody>
          {publications.map((p) => (
            <tr key={p.reference + p.topic} className="border-b border-border last:border-0">
              <td className="py-2 text-xs">{fmt(p.publicationDate)}</td>
              <td className="py-2 font-mono text-xs">{p.reference}</td>
              <td className="py-2">{p.topic}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
