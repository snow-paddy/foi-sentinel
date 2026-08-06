import { Info } from "lucide-react"
import { getCouncilName } from "@/lib/queries"

export const dynamic = "force-dynamic"

const STAGES = [
  "Receipt & logging", "Validity check", "Regime classification", "SAR redirect", "Duplicate / s.21 reuse",
  "Clarification", "Allocation", "Search & retrieval", "Cost assessment", "Exemption identification",
  "Public interest test", "Redaction", "Response drafting", "QA / sign-off", "Dispatch",
  "Disclosure log publish", "Internal review / ICO",
]

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
}

export default async function AboutPage() {
  const council = await getCouncilName()
  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-4">
      <div className="flex items-center gap-2">
        <Info className="size-5" style={{ color: "var(--brand-primary)" }} />
        <h1 className="text-2xl font-bold tracking-tight">About &amp; Architecture</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">How FOI Sentinel handles the statutory lifecycle for {council}, and where AI assists versus where humans decide.</p>

      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">The lifecycle (17 stages)</h2>
        <ol className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {STAGES.map((s, i) => <li key={s}><span className="tnum text-muted-foreground">{i + 1}.</span> {s}</li>)}
        </ol>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5" >
          <h2 className="text-base font-semibold" style={{ color: "var(--ok)" }}>AI assists</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
            <li>Triage: AI_CLASSIFY (regime), SENTIMENT (tone), AI_FILTER (s.14), AI_EXTRACT (scope)</li>
            <li>Precedent and s.21 duplicate matching against clean past responses (AI_SIMILARITY)</li>
            <li>Drafting disclosure / refusal letters (Cortex COMPLETE)</li>
            <li>Detecting personal data for redaction (AI_REDACT, AI_CLASSIFY, AI_EXTRACT)</li>
            <li>Grounded answer suggestions (Cortex Search)</li>
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--warn)" }}>Humans decide</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
            <li>Applying or disapplying exemptions (public interest test)</li>
            <li>Verifying every redaction before release</li>
            <li>Signing off and dispatching the final response</li>
            <li>Internal review outcomes and ICO handling</li>
          </ul>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">Snowflake features used</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
          <li>Cortex COMPLETE (mistral-large2), SENTIMENT, AI_CLASSIFY, AI_FILTER, AI_EXTRACT, AI_SIMILARITY, AI_REDACT</li>
          <li>Cortex Search services over council policy, disclosure logs and WhatDoTheyKnow</li>
          <li>Stored procedures for stage transitions, clock control, cost estimates and response generation</li>
          <li>Immutable event log (FOI_CASE_EVENT) for a full audit trail</li>
          <li>React on Snowpark Container Services (App Runtime)</li>
        </ul>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="text-base font-semibold">Legal basis</h2>
        <p className="mt-2 text-sm text-foreground/90">FOIA 2000 (s.1, s.10, s.12, s.14, s.17, s.21, s.40, s.43), EIR 2004 (reg. 5), DPA 2018 / UK GDPR (SAR), the Fees Regulations 2004, and the s.45 Code of Practice.</p>
      </Card>
    </main>
  )
}
