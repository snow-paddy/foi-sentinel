import type { PipelineStage } from "@/lib/queries"

/**
 * Centre-aligned funnel of open requests by lifecycle stage. Each stage bar is
 * sized by its open-case volume and centred; faint trapezoid "walls" connect
 * consecutive stages into a continuous funnel silhouette. Within a bar, the
 * blue segment is on-track and the red segment is at risk of breaching the
 * statutory deadline. Pure SVG — renders on the server.
 */
export function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const rows = stages.filter((s) => s.stage)
  const maxTotal = Math.max(1, ...rows.map((s) => s.total))

  const W = 760
  const labelW = 210
  const countW = 70
  const funnelMaxW = W - labelW - countW - 40 // usable funnel width
  const cx = labelW + 20 + funnelMaxW / 2
  const rowH = 30
  const gap = 8
  const H = rows.length * (rowH + gap) + gap

  const half = (t: number) => (t / maxTotal) * funnelMaxW / 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
         aria-label="Open requests by lifecycle stage">
      {/* Funnel walls — faint trapezoids between consecutive stage bars */}
      {rows.map((s, i) => {
        if (i === rows.length - 1) return null
        const next = rows[i + 1]
        const yb = gap + i * (rowH + gap) + rowH
        const yt = gap + (i + 1) * (rowH + gap)
        const h0 = half(s.total)
        const h1 = half(next.total)
        return (
          <polygon key={`wall-${i}`}
            points={`${cx - h0},${yb} ${cx + h0},${yb} ${cx + h1},${yt} ${cx - h1},${yt}`}
            fill="var(--chart-1)" opacity={0.06} />
        )
      })}

      {rows.map((s, i) => {
        const y = gap + i * (rowH + gap)
        const hw = half(s.total)
        const barW = hw * 2
        const left = cx - hw
        const otW = s.total ? (s.onTrack / s.total) * barW : 0
        const atW = barW - otW
        const href = `/cases?stage=${encodeURIComponent(s.stage)}`
        return (
          <a key={s.order} href={href} aria-label={`View ${s.total} cases at stage ${s.stage}`}>
            <g className="cursor-pointer [&>rect]:transition-opacity hover:[&>rect]:opacity-80">
            {/* stage label */}
            <text x={labelW} y={y + rowH / 2 + 4} textAnchor="end" fontSize="12.5"
                  fill="var(--muted-foreground)">{s.stage}</text>

            {s.total > 0 ? (
              <>
                <rect x={left} y={y} width={otW} height={rowH} rx={5}
                      fill="var(--chart-1)">
                  <title>{`${s.stage}: ${s.onTrack} on track (open cases)`}</title>
                </rect>
                {atW > 0.5 && (
                  <rect x={left + otW} y={y} width={atW} height={rowH} rx={5}
                        fill="var(--danger)">
                    <title>{`${s.stage}: ${s.atRisk} at risk`}</title>
                  </rect>
                )}
              </>
            ) : (
              <circle cx={cx} cy={y + rowH / 2} r={2.5} fill="var(--hairline)" />
            )}

            {/* count + at-risk flag */}
            <text x={W - countW + 6} y={y + rowH / 2 + 4} textAnchor="start"
                  fontSize="12.5" className="tnum" fill="var(--foreground)" fontWeight={600}>
              {s.total}
              {s.atRisk > 0 && (
                <tspan fill="var(--danger)" fontWeight={700}>{`  ·${s.atRisk}`}</tspan>
              )}
            </text>
            </g>
          </a>
        )
      })}
    </svg>
  )
}
