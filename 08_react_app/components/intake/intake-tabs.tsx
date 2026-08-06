"use client"

import { useState } from "react"
import { Mail, PenLine } from "lucide-react"
import { OutlookTest } from "@/components/intake/outlook-test"
import { IntakeComposer } from "@/components/intake/intake-composer"

type Tab = "outlook" | "inapp"

export function IntakeTabs({ liveMailbox, inbox }: { liveMailbox: string; inbox: string }) {
  const [tab, setTab] = useState<Tab>("outlook")

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/30 p-1">
        <button
          onClick={() => setTab("outlook")}
          aria-current={tab === "outlook"}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          style={tab === "outlook" ? { backgroundColor: "var(--brand-primary)", color: "white" } : { color: "var(--muted-foreground)" }}
        >
          <Mail className="size-4" /> Outlook Test
        </button>
        <button
          onClick={() => setTab("inapp")}
          aria-current={tab === "inapp"}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          style={tab === "inapp" ? { backgroundColor: "var(--brand-primary)", color: "white" } : { color: "var(--muted-foreground)" }}
        >
          <PenLine className="size-4" /> In-App Test
        </button>
      </div>

      {tab === "outlook" ? <OutlookTest mailbox={liveMailbox} /> : <IntakeComposer inbox={inbox} />}
    </div>
  )
}
