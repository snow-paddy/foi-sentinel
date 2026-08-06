"use client"

import { useRef, useState, type ReactNode } from "react"
import { Info, Copy, Check, Database } from "lucide-react"

/**
 * Rich "inspect" popover. Wraps a trigger (a chip/badge) and, on hover or click,
 * reveals a plain-English explanation of how a figure is derived, the Snowflake
 * source object(s) behind it, and a copyable suggested query so an officer (or a
 * sceptical buyer) can verify it in Snowsight. Keeps the underlying element's
 * native `title` as a graceful fallback where callers set one.
 */
export function InspectPopover({
  label,
  explanation,
  sources,
  query,
  align = "start",
  children,
}: {
  label: string
  explanation: ReactNode
  sources?: string[]
  query?: string
  align?: "start" | "end"
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }
  function hide() {
    closeTimer.current = setTimeout(() => setOpen(false), 140)
  }
  async function copy() {
    if (!query) return
    try {
      await navigator.clipboard.writeText(query)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        className="inline-flex cursor-help items-center"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </button>
      {open && (
        <div
          role="dialog"
          className={`absolute top-full z-50 mt-1.5 w-80 rounded-lg border border-border bg-card text-card-foreground shadow-lg ${
            align === "end" ? "right-0" : "left-0"
          }`}
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-semibold">
            <Info className="size-3.5" style={{ color: "var(--brand-primary)" }} />
            {label}
          </div>
          <div className="space-y-2 p-3">
            <p className="text-xs leading-relaxed text-muted-foreground">{explanation}</p>
            {sources && sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Database className="size-3" /> Source
                </span>
                {sources.map((s) => (
                  <span key={s} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {query && (
              <div className="overflow-hidden rounded-md border border-border bg-muted/40">
                <div className="flex items-center justify-between border-b border-border px-2 py-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Inspect in Snowflake
                  </span>
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto px-2 py-1.5 text-[10px] leading-relaxed">
                  <code>{query}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  )
}
