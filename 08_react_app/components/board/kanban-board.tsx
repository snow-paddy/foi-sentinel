"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { AlertTriangle, Flag } from "lucide-react"
import type { BoardCase } from "@/lib/queries"
import { sentimentBand } from "@/lib/format"
import { PriorityChip } from "@/components/shared/priority-chip"
import { ComplexityChip } from "@/components/shared/complexity-chip"
import { PrecedentPill } from "@/components/shared/precedent-match"
import { DemoBadge } from "@/components/shared/demo-badge"

function ragColor(c: BoardCase): string {
  if (c.wdRemaining == null) return "var(--muted-foreground)"
  if (c.wdRemaining < 0 || c.rag.toUpperCase() === "RED") return "var(--danger)"
  if (c.rag.toUpperCase() === "AMBER") return "var(--warn)"
  return "var(--ok)"
}

// Challenge (s.50) sits outside the linear 1→5 flow — it is a requester-led
// status, not a stage an officer advances a case into.
const CHALLENGE_ID = "Challenge"

type Toast = { kind: "ok" | "err"; msg: string } | null

export function KanbanBoard({ cases, phases }: { cases: BoardCase[]; phases: { id: string; label?: string; note?: string }[] }) {
  const router = useRouter()
  const [cards, setCards] = useState<BoardCase[]>(cases)
  const [toast, setToast] = useState<Toast>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const lastDragEnd = useRef(0)

  useEffect(() => setCards(cases), [cases])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const byPhase = (pid: string) => cards.filter((c) => c.phaseId === pid)

  async function onDragEnd(r: DropResult) {
    lastDragEnd.current = Date.now()
    if (!r.destination) return
    const from = r.source.droppableId
    const to = r.destination.droppableId
    const ref = r.draggableId
    if (from === to) return

    // Challenge (s.50) is requester-led — cases arrive there via escalation, not
    // by an officer moving a card. It is not a valid drag source or target.
    if (to === CHALLENGE_ID || from === CHALLENGE_ID) {
      setToast({ kind: "err", msg: "Challenge (s.50) is requester-led — raise it from Reviews & ICO, not the board." })
      return
    }

    const prev = cards
    setCards((cs) => cs.map((c) => (c.reference === ref ? { ...c, phaseId: to } : c)))
    setPending((p) => new Set(p).add(ref))

    try {
      const res = await fetch("/api/advance-stage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: ref, toPhase: to }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed")
      setCards((cs) =>
        cs.map((c) =>
          c.reference === ref ? { ...c, currentStage: data.newStage, stageName: data.newStageName } : c,
        ),
      )
      setToast({ kind: "ok", msg: `${ref} → ${data.newStageName}` })
    } catch (e) {
      setCards(prev) // revert
      setToast({ kind: "err", msg: `Couldn't move ${ref}: ${e instanceof Error ? e.message : "error"}` })
    } finally {
      setPending((p) => {
        const next = new Set(p)
        next.delete(ref)
        return next
      })
    }
  }

  function openCase(ref: string) {
    if (Date.now() - lastDragEnd.current < 250) return
    router.push(`/cases/${encodeURIComponent(ref)}`)
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex items-start gap-3 overflow-x-auto pb-4">
          {phases.map((p) => {
            const items = byPhase(p.id)
            const isChallenge = p.id === CHALLENGE_ID
            return (
              <Droppable droppableId={p.id} key={p.id} isDropDisabled={isChallenge}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-w-[220px] flex-1 rounded-xl border p-2.5 transition-colors ${
                      isChallenge
                        ? "border-dashed border-[var(--warn)] bg-[var(--warn-bg)]/30 md:ml-2"
                        : snapshot.isDraggingOver
                          ? "border-[var(--brand-primary)] bg-muted/50"
                          : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="mb-2.5 flex items-center justify-between gap-2 border-b-2 pb-2"
                         style={{ borderColor: isChallenge ? "var(--warn)" : "var(--brand-primary)" }}>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold">{p.label ?? p.id}</div>
                        {p.note && <div className="text-[10px] font-medium text-muted-foreground">{p.note}</div>}
                        {isChallenge && <div className="text-[10px] font-medium" style={{ color: "var(--warn)" }}>Requester-led · not draggable</div>}
                      </div>
                      <span className="tnum shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                        {items.length}
                      </span>
                    </div>

                    {items.map((c, i) => (
                      <Draggable draggableId={c.reference} index={i} key={c.reference} isDragDisabled={isChallenge}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            onClick={() => openCase(c.reference)}
                            className={`mb-2.5 rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
                              isChallenge ? "cursor-pointer" : "cursor-grab"
                            } ${snap.isDragging ? "shadow-lg" : ""} ${pending.has(c.reference) ? "opacity-60" : ""}`}
                            style={{ borderLeft: `4px solid ${ragColor(c)}`, ...prov.draggableProps.style }}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="size-2.5 shrink-0 rounded-full" style={{ background: ragColor(c) }} />
                              <span className="font-mono text-xs font-bold">{c.reference}</span>
                              <DemoBadge reference={c.reference} />
                              {c.complexity != null && (
                                <span className="text-[11px]"><ComplexityChip score={c.complexity} factors={c.complexityFactors} /></span>
                              )}
                              {c.priorityBand && (
                                <span className="ml-auto">
                                  <PriorityChip band={c.priorityBand} score={c.priorityScore} align="right" />
                                </span>
                              )}
                            </div>

                            <div className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug">{c.subject}</div>

                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {c.regime} · {c.stageName} ·{" "}
                              {c.wdRemaining == null ? (
                                "paused"
                              ) : c.wdRemaining < 0 ? (
                                <span style={{ color: "var(--danger)" }}>{Math.abs(c.wdRemaining)}d overdue</span>
                              ) : (
                                `${c.wdRemaining}d left`
                              )}
                              {c.isVexatious && (
                                <span style={{ color: "var(--danger)" }} title="Flagged as potentially vexatious (s.14)">
                                  {" "}<AlertTriangle className="inline size-3 -mt-0.5" />
                                </span>
                              )}
                            </div>

                            <div className="mt-1 truncate text-[10px] text-muted-foreground" title={c.ownerTitle}>
                              {c.ownerTitle}
                            </div>

                            {(c.sentiment != null || c.precedentPct != null) && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                                {c.sentiment != null && (() => {
                                  const sb = sentimentBand(c.sentiment)
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1 font-bold"
                                      style={{ color: sb.color }}
                                      title={c.sentimentRationale || `Requester sentiment ${c.sentiment.toFixed(2)} (escalation-risk signal)`}
                                    >
                                      {sb.glyph} {sb.label}
                                    </span>
                                  )
                                })()}
                                {c.precedentPct != null && <PrecedentPill pct={c.precedentPct} />}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {items.length === 0 && (
                      <div className="py-3 text-center text-xs text-muted-foreground">—</div>
                    )}
                  </div>
                )}
              </Droppable>
            )
          })}
        </div>
      </DragDropContext>

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg"
          style={{
            background: "var(--card)",
            borderColor: toast.kind === "ok" ? "var(--ok)" : "var(--danger)",
            color: toast.kind === "ok" ? "var(--ok)" : "var(--danger)",
          }}
        >
          {toast.kind === "ok" ? <Flag className="size-4" /> : <AlertTriangle className="size-4" />}
          {toast.msg}
        </div>
      )}
    </>
  )
}
