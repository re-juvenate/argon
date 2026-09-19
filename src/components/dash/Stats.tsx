import type { DragEvent } from "react"
import type { NodeResult } from "#graph"
import { fmt, GRAPH_MIME, Metric, METRICS, type GraphPayload } from "./metrics"

interface StatsProps {
  result?: NodeResult
  nodeId?: string
  name: string
  color: string
}

const STRIP: Metric[] = [Metric.Served, Metric.P50, Metric.Drop]

export const startGraphDrag = (e: DragEvent, payload: GraphPayload) => {
  e.stopPropagation()
  e.dataTransfer.setData(GRAPH_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = "copy"
}

export default function Stats({ result, nodeId, name, color }: StatsProps) {
  if (!result) return null
  return (
    <div className="flex items-center justify-between gap-3 select-none">
      {STRIP.map((metric) => {
        const spec = METRICS[metric]
        return (
          <span
            key={metric}
            draggable={!!nodeId}
            onDragStart={(e) => nodeId && startGraphDrag(e, { nodeId, metric, name, color })}
            className="flex flex-col leading-tight cursor-grab active:cursor-grabbing"
          >
            <span className="text-[10px] uppercase tracking-wide text-[#777777]">{spec.label}</span>
            <span className="font-mono text-xs text-gray-200">
              {fmt(spec.pick(result))} {spec.unit}
            </span>
          </span>
        )
      })}
    </div>
  )
}

export const sparkData = (history: readonly NodeResult[], metric = Metric.Served) =>
  history.map((r, i) => ({ date: i, Semi: METRICS[metric].pick(r) }))
