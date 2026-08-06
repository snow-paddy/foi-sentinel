import { GraduationCap } from "lucide-react"
import Link from "next/link"
import { getTriageLearning, getSuggestedAnswerEval } from "@/lib/queries"

export const dynamic = "force-dynamic"

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
}

export default async function LearningPage() {
  const { routing, threshold, modelCompare } = await getTriageLearning()
  const answerEval = await getSuggestedAnswerEval()
  const total = routing.reduce((s, r) => s + r.n, 0) || 1
  const auto = routing.find((r) => r.routed === "AUTO")?.n ?? 0
  const review = routing.find((r) => r.routed === "REVIEW")?.n ?? 0
  const maxAcc = Math.max(1, ...modelCompare.map((m) => m.accuracy))
  const verdictN = (v: string) => answerEval.verdicts.find((x) => x.verdict === v)?.n ?? 0

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-5" style={{ color: "var(--brand-primary)" }} />
        <h1 className="text-2xl font-bold tracking-tight">Tuning &amp; Learning</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Confidence-routed triage, the human-in-the-loop learning loop, a real Cortex fine-tune comparison, and grounded-answer quality scored by an LLM judge. See the live processing pipeline on the <Link href="/intake" className="font-medium" style={{ color: "var(--brand-primary)" }}>Intake</Link> page.</p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Confidence-routed triage</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Auto-accept threshold {Math.round(threshold * 100)}% confidence.</p>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <div className="flex justify-between"><span>Auto-accepted</span><span className="tnum text-muted-foreground">{auto} ({Math.round((auto / total) * 100)}%)</span></div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(auto / total) * 100}%`, background: "var(--ok)" }} /></div>
            </div>
            <div>
              <div className="flex justify-between"><span>Routed to human review</span><span className="tnum text-muted-foreground">{review} ({Math.round((review / total) * 100)}%)</span></div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(review / total) * 100}%`, background: "var(--warn)" }} /></div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Low-confidence cases are routed to a human; their corrections become labelled training data for the next fine-tune.</p>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Fine-tune comparison</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Held-out eval accuracy (real Cortex fine-tune).</p>
          {modelCompare.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Fine-tune comparison not available yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {modelCompare.map((m) => (
                <li key={m.model}>
                  <div className="flex justify-between"><span>{m.model}</span><span className="tnum text-muted-foreground">{Math.round(m.accuracy * 100)}% · n={m.evalN}</span></div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(m.accuracy / maxAcc) * 100}%`, background: m.model.includes("tuned") ? "var(--ok)" : "var(--muted-foreground)" }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Suggested-answer quality</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">LLM-judge eval over {answerEval.evaluated} precomputed answers.</p>
          {answerEval.evaluated === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No precomputed answers evaluated yet.</p>
          ) : (
            <>
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <div className="flex justify-between"><span>Groundedness</span><span className="tnum text-muted-foreground">{Math.round((answerEval.avgGroundedness ?? 0) * 100)}%</span></div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(answerEval.avgGroundedness ?? 0) * 100}%`, background: "var(--ok)" }} /></div>
                </div>
                <div>
                  <div className="flex justify-between"><span>Coverage</span><span className="tnum text-muted-foreground">{Math.round((answerEval.avgCoverage ?? 0) * 100)}%</span></div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(answerEval.avgCoverage ?? 0) * 100}%`, background: "var(--brand-primary)" }} /></div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="rounded-md px-2 py-1 font-semibold" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>{verdictN("PASS")} pass</span>
                <span className="rounded-md px-2 py-1 font-semibold" style={{ background: "var(--warn-bg)", color: "var(--warn-text)" }}>{verdictN("WEAK")} weak</span>
                <span className="rounded-md px-2 py-1 font-semibold" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{verdictN("FAIL")} fail</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Each precomputed answer is scored for groundedness (claims trace to cited sources) and coverage (it answers the request). Weak/fail drafts flag where the corpora or prompt need tuning.</p>
            </>
          )}
        </Card>
      </div>
    </main>
  )
}
