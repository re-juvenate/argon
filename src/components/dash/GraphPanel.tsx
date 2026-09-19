import { useEffect, useRef, type RefObject } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { Draggable } from "gsap/Draggable"

import Graph, { type ChartDataItem } from "./nodeoptions/graph"

export interface Docked {
  id: string
  data: ChartDataItem[]
  x: number
  y: number
}

const GRID = 24

const makeChartData = (values: number[]): ChartDataItem[] =>
  values.map((Throughput, i) => ({ time: "1", Throughput, Time: i }))

export const DEFAULT_DOCKED: Docked[] = [
  {
    id: "graph-1",
    x: 24,
    y: 48,
    data: makeChartData([2890, 2756, 3322, 3470, 3475, 3129, 3560, 3402]),
  },
  {
    id: "graph-2",
    x: 388,
    y: 48,
    data: makeChartData([1240, 1580, 1420, 1930, 2210, 2050, 2480, 2760]),
  },
]

interface DockedGraphCardProps {
  item: Docked
  cards: RefObject<Map<string, HTMLDivElement | null>>
  onMove: (id: string, x: number, y: number) => void
}

export function DockedGraphCard({ item, cards, onMove }: DockedGraphCardProps) {
  const ref = useRef<HTMLDivElement>(null)

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

    const snap = (axis: "x" | "y") => (value: number) => {
      const parent = el.parentElement
      if (!parent) return value

      const extent =
        axis === "x" ? parent.clientWidth - el.offsetWidth : parent.clientHeight - el.offsetHeight

      const points: number[] = []
      for (let p = 0; p <= Math.max(0, extent); p += GRID) points.push(p)

      cards.current.forEach((other, id) => {
        if (id === item.id || !other) return
        const base = Number(gsap.getProperty(other, axis))
        const size = axis === "x" ? other.offsetWidth : other.offsetHeight
        points.push(base, base + size)
      })

      return points.reduce((best, p) => (Math.abs(p - value) < Math.abs(best - value) ? p : best))
    }

    const [instance] = Draggable.create(el, {
      type: "x,y",
      bounds: el.parentElement ?? undefined,
      inertia: true,
      edgeResistance: 1,
      snap: { x: snap("x"), y: snap("y") },

      onDragEnd(this: Draggable) {
        onMove(item.id, this.x, this.y)
      },
      onThrowComplete(this: Draggable) {
        onMove(item.id, this.x, this.y)
      },
    })

    return () => {
      instance.kill()
      gsap.killTweensOf(el)
    }
  }, [])

  return (
    <div
      ref={(el) => {
        ref.current = el
        cards.current.set(item.id, el)
      }}
      style={{
        width: 340,
        height: 430,
        minWidth: 280,
        minHeight: 320,
        maxWidth: "100%",
        maxHeight: "100%",
        resize: "both",
        overflow: "hidden",
      }}
      className="absolute top-0 left-0 cursor-grab active:cursor-grabbing"
    >
      <Graph chartdata={item.data} fill />
    </div>
  )
}
