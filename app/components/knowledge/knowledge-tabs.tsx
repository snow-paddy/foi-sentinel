"use client"

import { useState } from "react"
import { BookOpen, Scale } from "lucide-react"
import { GuidanceSearch } from "@/components/guidance/guidance-search"
import type { PublishedTopic } from "@/lib/queries"

const TABS = [
  { id: "guidance", label: "Guidance & precedent", icon: BookOpen },
  { id: "legislation", label: "Legislation library", icon: Scale },
] as const

type TabId = (typeof TABS)[number]["id"]

export function KnowledgeTabs({
  topics,
  legislationSlot,
  initialTab = "guidance",
}: {
  topics: PublishedTopic[]
  legislationSlot: React.ReactNode
  initialTab?: TabId
}) {
  const [tab, setTab] = useState<TabId>(initialTab)

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className="inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium"
                  style={tab === t.id ? { borderColor: "var(--brand-primary)", color: "var(--brand-primary)" } : { borderColor: "transparent", color: "var(--muted-foreground)" }}>
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "guidance" && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Officer research index.</span>{" "}
              Search across three corpora at once: council &amp; ICO guidance, this council&rsquo;s past disclosures, and cross-authority precedent (WhatDoTheyKnow).
              A common use is spotting when a question has already been answered: matches from this council&rsquo;s own disclosure logs are flagged as a{" "}
              <span className="font-medium text-foreground">section 21</span> &ldquo;already published&rdquo; reply you can send.
            </p>
            <GuidanceSearch topics={topics} />
          </>
        )}
        {tab === "legislation" && legislationSlot}
      </div>
    </div>
  )
}
