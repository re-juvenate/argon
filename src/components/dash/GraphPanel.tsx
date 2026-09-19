import { useEffect, useMemo, useRef, type RefObject } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { Draggable } from "gsap/Draggable"
import { InertiaPlugin } from "gsap/InertiaPlugin"

import Graph, { type ChartDataItem } from "./nodeoptions/graph"
import type { NodeResult } from "#graph"
import { Metric, METRICS } from "./metrics"
import { useNodeResult } from "./Simulation"

gsap.registerPlugin(Draggable, InertiaPlugin)

export interface Docked {
  id: string
  nodeId: string
  metric: Metric
  name: string
  x: number
  y: number
  color?: string
}

/** Snap grid in px; card sizes are multiples of it so cards tile edge-to-edge. */
export const GRID = 48
export const CARD_W = 336 // 7 * GRID
const CARD_H = 384 // 8 * GRID

export const DEFAULT_DOCKED: Docked[] = []

const chartData = (history: readonly NodeResult[], metric: Metric): ChartDataItem[] =>
  history.map((r, i) => ({ time: String(i), Throughput: METRICS[metric].pick(r), Time: i }))

interface DockedGraphCardProps {
  item: Docked
  cards: RefObject<Map<string, HTMLDivElement | null>>
  onMove: (id: string, x: number, y: number) => void
}

/**
 * A docked graph card. Drags snap to the panel grid with a springy
 * Back.easeOut settle (inspired by the GSAP "snap to grid based on another
 * object" demo), so cards always land aligned and can tile into a dashboard.
 */
export function DockedGraphCard({ item, cards, onMove }: DockedGraphCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { history } = useNodeResult(item.nodeId)
  const spec = METRICS[item.metric]
  const data = useMemo(() => chartData(history, item.metric), [history, item.metric])

  useEffect(
    () => () => {
      cards.current.delete(item.id)
    },
    [cards, item.id],
  )

  useGSAP(() => {
    const el = ref.current
    if (!el) return

    gsap.set(el, { x: item.x, y: item.y })

    const grid = document.createElement("div")
    grid.setAttribute("data-dock-grid", "")
    Object.assign(grid.style, {
      position: "absolute",
      inset: `-${GRID}px`,
      pointerEvents: "none",
      opacity: "0",
      backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.28) 1px, transparent 1px)`,
      backgroundSize: `${GRID}px ${GRID}px`,
      backgroundPosition: `${GRID - 1}px ${GRID - 1}px`,
    })
    el.parentElement?.prepend(grid)

    const snap = (value: number) => Math.round(value / GRID) * GRID

    const [instance] = Draggable.create(el, {
      type: "x,y",
      bounds: el.parentElement ?? undefined,
      inertia: false,
      zIndexBoost: true,

      onPress(this: Draggable) {
        gsap.to(grid, { opacity: 1, duration: 0.15 })
      },

      // Live rubber-band to the grid while dragging, then a springy settle.
      onDrag(this: Draggable) {
        gsap.to(el, {
          x: snap(this.x),
          y: snap(this.y),
          duration: 0.5,
          ease: "back.out(2)",
          overwrite: "auto",
        })
      },

      onDragEnd(this: Draggable) {
        gsap.to(grid, { opacity: 0, duration: 0.25 })
        onMove(item.id, snap(this.x), snap(this.y))
      },

      onThrowComplete() {
        onMove(item.id, snap(Number(gsap.getProperty(el, "x"))), snap(Number(gsap.getProperty(el, "y"))))
      },
    })

    return () => {
      instance.kill()
      gsap.killTweensOf(el)
      grid.remove()
    }
  }, [])

  return (
    <div
      ref={(el) => {
        ref.current = el
        cards.current.set(item.id, el)
      }}
      style={{
        width: CARD_W,
        height: CARD_H,
        resize: "both",
        overflow: "hidden",
      }}
      className="absolute top-0 left-0 cursor-grab active:cursor-grabbing rounded-lg border border-[#1f1f1f] shadow-lg shadow-black/40"
    >
      <Graph chartdata={data} fill color={item.color} title={`${item.name} · ${spec.label}`} unit={spec.unit} />
    </div>
  )
}
