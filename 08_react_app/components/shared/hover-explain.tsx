import type { ReactNode, CSSProperties } from "react"

export interface HoverExplainRow {
  label: string
  value: ReactNode
}

/**
 * Reusable, JS-free explanatory hover card. Standardises the "hover a badge to see
 * how it was derived" pattern (Identity verified, Chain verified, complexity, precedent)
 * on one light popover, so they all look and behave the same. Pure CSS group-hover /
 * focus-within, so it works in both server and client components.
 *
 * The trigger keeps its own colours via `className`/`style`; the popover opens downward
 * (top-full) so it clears horizontally-scrolling containers like the board.
 */
export function HoverExplain({
  children,
  title,
  description,
  rows,
  footer,
  align = "left",
  width = "w-72",
  className = "",
  style,
}: {
  children: ReactNode
  title: string
  description?: ReactNode
  rows?: HoverExplainRow[]
  footer?: ReactNode
  align?: "left" | "right"
  width?: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className="group relative inline-flex">
      <span tabIndex={0} className={`inline-flex cursor-help items-center gap-1 outline-none ${className}`} style={style}>
        {children}
      </span>
      <span
        className={`pointer-events-none absolute top-full z-30 mt-1 hidden ${width} max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-3 text-left font-normal normal-case tracking-normal text-card-foreground shadow-lg group-hover:block group-focus-within:block ${align === "right" ? "right-0" : "left-0"}`}
      >
        <span className="block text-xs font-semibold">{title}</span>
        {description && <span className="mt-1 block text-xs text-muted-foreground">{description}</span>}
        {rows && rows.length > 0 && (
          <span className="mt-2 block space-y-1.5 text-xs">
            {rows.map((r, i) => (
              <span key={i} className="flex gap-2">
                <span className="w-16 shrink-0 text-muted-foreground">{r.label}</span>
                <span className="min-w-0">{r.value}</span>
              </span>
            ))}
          </span>
        )}
        {footer && <span className="mt-2 block border-t border-border pt-2 text-[11px] text-muted-foreground">{footer}</span>}
      </span>
    </span>
  )
}
