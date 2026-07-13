import Link from "next/link"
import type { WordWeight } from "@/lib/queries"

/**
 * Ranked horizontal bars over the same corpus as the word cloud — the precise,
 * scannable counterpart to the cloud's visual gestalt. Bars reuse the app's
 * hand-rolled CSS-bar pattern (see reporting page) and each row links to the
 * filtered case list, mirroring the cloud's click-through.
 */
export function WordFrequencyBars({ words, top = 12 }: { words: WordWeight[]; top?: number }) {
  const rows = words.slice(0, top)
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">Not enough request text to surface themes yet.</p>
  }
  const max = rows[0].weight

  return (
    <ol className="flex flex-col gap-2">
      {rows.map((w, i) => (
        <li key={w.term}>
          <Link
            href={`/cases?view=list&keyword=${encodeURIComponent(w.term)}`}
            className="group block rounded-md px-1 py-0.5 hover:bg-muted/60"
            title={`${w.weight} mention${w.weight === 1 ? "" : "s"}. Click to see these cases`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium capitalize">
                <span className="mr-2 tnum text-muted-foreground">{i + 1}.</span>
                {w.term}
              </span>
              <span className="tnum text-muted-foreground">{w.weight}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-opacity group-hover:opacity-80"
                style={{ width: `${(w.weight / max) * 100}%`, background: "var(--brand-primary)" }}
              />
            </div>
          </Link>
        </li>
      ))}
    </ol>
  )
}
