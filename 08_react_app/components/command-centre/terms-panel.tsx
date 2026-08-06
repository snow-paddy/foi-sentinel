"use client"

import { useState } from "react"
import type { WordWeight } from "@/lib/queries"
import { WordCloud } from "@/components/command-centre/word-cloud"
import { WordFrequencyBars } from "@/components/command-centre/word-frequency-bars"

type View = "ranked" | "cloud"

/**
 * One card, two ways to read the same signal: a ranked bar list and a word
 * cloud over the real request corpus. Tabbing between them frees the adjacent
 * card space for requester patterns.
 */
export function TermsPanel({ words }: { words: WordWeight[] }) {
  const [view, setView] = useState<View>("ranked")

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Most frequent terms, ranked</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            The most frequent terms across the real request corpus. Click any term to see the cases behind it.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Term view"
          className="flex shrink-0 rounded-lg border border-border bg-background p-0.5"
        >
          <TabButton active={view === "ranked"} onClick={() => setView("ranked")}>
            Ranked
          </TabButton>
          <TabButton active={view === "cloud"} onClick={() => setView("cloud")}>
            Word cloud
          </TabButton>
        </div>
      </div>

      {view === "ranked" ? <WordFrequencyBars words={words} top={12} /> : <WordCloud words={words} />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="rounded-md px-3 py-1 text-sm font-medium transition-colors"
      style={
        active
          ? { background: "var(--brand-primary)", color: "#fff" }
          : { color: "var(--muted-foreground)" }
      }
    >
      {children}
    </button>
  )
}
