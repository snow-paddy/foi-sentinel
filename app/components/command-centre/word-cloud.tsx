"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import cloud from "d3-cloud"
import type { WordWeight } from "@/lib/queries"

type Placed = {
  text: string
  size: number
  weight: number
  count: number
  x: number
  y: number
  rotate: number
}

const WIDTH = 540
const HEIGHT = 320
const PALETTE = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"]

/**
 * Spiral-packed word cloud (d3-cloud) over the real request corpus. Layout runs
 * client-side only (d3-cloud measures text on a canvas), so the server renders
 * an empty frame and the effect fills it after hydration. Font size uses a sqrt
 * scale so a small, skewed corpus still spreads across a readable range.
 */
export function WordCloud({ words }: { words: WordWeight[] }) {
  const router = useRouter()
  const [placed, setPlaced] = useState<Placed[]>([])
  const [done, setDone] = useState(false)
  const mounted = useRef(true)

  // Colour each term by frequency rank so the palette reads as a heat order.
  const colorFor = useMemo(() => {
    const ranked = [...words].sort((a, b) => b.weight - a.weight).map((w) => w.term)
    return (term: string) => {
      const i = ranked.indexOf(term)
      const bucket = Math.min(PALETTE.length - 1, Math.floor((i / Math.max(1, ranked.length)) * PALETTE.length))
      return PALETTE[bucket]
    }
  }, [words])

  useEffect(() => {
    mounted.current = true
    if (!words.length) {
      setDone(true)
      return
    }
    const max = words[0].weight
    const min = words[words.length - 1].weight
    const span = Math.max(1, max - min)
    const fontSize = (w: number) => 14 + Math.sqrt((w - min) / span) * 50 // 14–64px

    const layout = cloud<Placed>()
      .size([WIDTH, HEIGHT])
      .words(
        words.map((w) => ({
          text: w.term,
          weight: w.weight,
          count: w.weight, // d3-cloud overwrites `weight` with the font-weight during layout, so keep the real mention count here
          size: fontSize(w.weight),
          x: 0,
          y: 0,
          rotate: 0,
        })),
      )
      .padding(3)
      .rotate((d) => (d.text.length > 14 ? 0 : Math.random() < 0.72 ? 0 : 90))
      .font("system-ui, sans-serif")
      .fontWeight((d) => (d.weight === max ? 800 : d.weight > (min + max) / 2 ? 700 : 600))
      .fontSize((d) => d.size)
      .spiral("archimedean")
      .on("end", (out) => {
        if (mounted.current) {
          setPlaced(out as Placed[])
          setDone(true)
        }
      })
    layout.start()
    return () => {
      mounted.current = false
      layout.stop()
    }
  }, [words])

  if (!words.length) {
    return <p className="text-sm text-muted-foreground">Not enough request text to surface themes yet.</p>
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
      {!done && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Laying out themes…
        </div>
      )}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-full w-full"
        role="img"
        aria-label="Word cloud of the most frequent terms in the request corpus"
      >
        <g transform={`translate(${WIDTH / 2}, ${HEIGHT / 2})`}>
          {placed.map((w) => (
            <text
              key={w.text}
              textAnchor="middle"
              transform={`translate(${w.x}, ${w.y}) rotate(${w.rotate})`}
              onClick={() => router.push(`/cases?view=list&keyword=${encodeURIComponent(w.text)}`)}
              className="cursor-pointer transition-opacity hover:opacity-60"
              style={{
                fontSize: `${w.size}px`,
                fontWeight: w.count === Math.max(...words.map((x) => x.weight)) ? 800 : 600,
                fill: `var(${colorFor(w.text)})`,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              <title>{`${w.text}: ${w.count} mention${w.count === 1 ? "" : "s"}. Click to see these cases`}</title>
              {w.text}
            </text>
          ))}
        </g>
      </svg>
    </div>
  )
}
