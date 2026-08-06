"use client"

/**
 * Bespoke semicircular SLA gauge (speedometer). The arc fills to `pct`, coloured
 * by performance against `target`, with a target tick and a large centre readout.
 * On mount the arc sweeps up and the centre number counts up from 0 to `pct`
 * (~1.2s, ease-out), for a polished start-up. Respects prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from "react"

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

// Arc spanning the top semicircle: -90° (left) → +90° (right), clockwise.
function arcPath(cx: number, cy: number, r: number, startA: number, endA: number) {
  const s = polar(cx, cy, r, startA)
  const e = polar(cx, cy, r, endA)
  const large = endA - startA <= 180 ? 0 : 1
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export function SlaGauge({ pct, target }: { pct: number; target: number }) {
  const W = 280
  const H = 168
  const cx = W / 2
  const cy = 150
  const r = 116
  const stroke = 22

  const clampedTarget = Math.max(0, Math.min(100, pct))

  // Animated value; starts at 0 and eases up to the real figure on mount.
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      setValue(clampedTarget)
      return
    }
    const duration = 1200
    let start: number | null = null
    const step = (ts: number) => {
      if (start == null) start = ts
      const t = Math.min(1, (ts - start) / duration)
      setValue(clampedTarget * easeOut(t))
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [clampedTarget])

  const clamped = Math.max(0, Math.min(100, value))
  const displayPct = Math.round(clamped)
  const valueAngle = -90 + (180 * clamped) / 100
  const targetAngle = -90 + (180 * Math.max(0, Math.min(100, target))) / 100

  // Colour is resolved against the final figure so it doesn't flicker bands mid-sweep.
  const color =
    pct >= target ? "var(--ok)" : pct >= target - 10 ? "var(--warn-text)" : "var(--danger)"

  const tickOuter = polar(cx, cy, r + stroke / 2 + 3, targetAngle)
  const tickInner = polar(cx, cy, r - stroke / 2 - 3, targetAngle)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[300px]" role="img"
           aria-label={`${pct} percent answered within the statutory deadline, target ${target} percent`}>
        {/* Track */}
        <path d={arcPath(cx, cy, r, -90, 90)} fill="none" stroke="var(--hairline)"
              strokeWidth={stroke} strokeLinecap="round" />
        {/* Value arc */}
        {clamped > 0 && (
          <path d={arcPath(cx, cy, r, -90, valueAngle)} fill="none" stroke={color}
                strokeWidth={stroke} strokeLinecap="round" />
        )}
        {/* Target tick */}
        <line x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y}
              stroke="var(--foreground)" strokeWidth={3} />
        {/* Centre readout */}
        <text x={cx} y={cy - 30} textAnchor="middle" className="tnum"
              fontSize="46" fontWeight="800" fill="var(--foreground)">{displayPct}%</text>
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="12.5"
              fill="var(--muted-foreground)">answered in time</text>
      </svg>
      <div className="mt-1 text-xs text-muted-foreground">
        Target <span className="font-semibold tnum text-foreground">{target}%</span>
        {" · "}
        <span className="font-semibold" style={{ color }}>
          {pct >= target ? "on target" : `${target - pct} pts below`}
        </span>
      </div>
    </div>
  )
}
