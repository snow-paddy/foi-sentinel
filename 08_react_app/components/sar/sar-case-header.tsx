import Link from "next/link"
import { ArrowLeft, ShieldCheck, UserCheck, Clock, Hash } from "lucide-react"
import type { SarSubject, SarCaseMeta } from "@/lib/queries"
import { HoverExplain } from "@/components/shared/hover-explain"

/** Case-context header for an opened SAR. The pseudonymised requester from the queue
 * resolves here to the verified data subject, after identity verification. */
export function SarCaseHeader({ subject, meta }: { subject: SarSubject; meta: SarCaseMeta }) {
  const paused = /STOPPED|PAUSE/i.test(meta.clockState)
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/sar" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-[var(--brand-primary)]">
          <ArrowLeft className="size-3" /> All Subject Access Requests
        </Link>
        <HoverExplain
          align="right"
          width="w-96"
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: "var(--ok-bg)", color: "var(--ok)" }}
          title="How this identity was verified"
          description={<>The request was logged as <span className="font-medium">{meta.requester || "a pseudonymised requester"}</span>. Identity is never assumed from the request itself, so it is confirmed out of band before any records are revealed.</>}
          rows={[
            { label: "Verified", value: <>{subject.verifiedOn || "\u2014"} by {subject.verifiedBy || "an Information Governance officer"}</> },
            { label: "Method", value: subject.verificationMethod || "Photo ID and proof of address" },
            { label: "Basis", value: subject.verificationBasis || "Matched to the council record for the quoted claim reference" },
          ]}
          footer="Reasonable measures under UK GDPR Art 12(6). The one-month clock started only once identity was confirmed."
        >
          <ShieldCheck className="size-3" /> Identity verified
        </HoverExplain>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-sm">{meta.reference}</span>
        <span className="text-xs text-muted-foreground">received as</span>
        <span className="text-sm">{meta.requester || "pseudonymised requester"}</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><UserCheck className="size-3" /> Verified data subject</div>
          <p className="mt-1 text-sm font-semibold">{subject.requesterName}</p>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Hash className="size-2.5" /> claim {subject.claimRef}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> Statutory clock</div>
          <p className="mt-1 text-sm font-semibold">Due {meta.due || "—"}</p>
          <p className="text-xs" style={{ color: paused ? "var(--warn-text)" : "var(--muted-foreground)" }}>
            {paused ? "Paused pending clarification" : "Running · one calendar month"}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Request</div>
          <p className="mt-1 text-sm">{meta.subjectSummary || "Subject access request"}</p>
          <p className="text-xs text-muted-foreground">Received {meta.received || "—"}</p>
        </div>
      </div>
    </div>
  )
}
