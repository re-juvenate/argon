import { useEffect, useMemo, useRef } from "react"
import { GridStack, useGridStack } from "gridstack/dist/react"
import type { GridStackOptions } from "gridstack"
import "gridstack/dist/gridstack.css"

import Graph, { type ChartDataItem } from "./nodeoptions/graph"
import type { NodeResult } from "#graph"
import { Metric, METRICS } from "./metrics"
import { useNodeResult } from "./Simulation"

export interface Docked {
  id: string
  nodeId: string
  metric: Metric
  name: string
  x: number
  y: number
  w: number
  h: number
  color?: string
}

export const CARD_W = 7
export const CARD_H = 8
export const COLUMNS = 24

export const DEFAULT_DOCKED: Docked[] = []

const chartData = (history: readonly NodeResult[], metric: Metric): ChartDataItem[] =>
  history.map((r, i) => ({ time: String(i), Throughput: METRICS[metric].pick(r), Time: i }))

interface GraphWidgetProps {
  id: string
  nodeId: string
  metric: Metric
  name: string
  color?: string
}

function GraphWidget({ id, nodeId, metric, name, color }: GraphWidgetProps) {
  const { history } = useNodeResult(nodeId)
  const spec = METRICS[metric]
  const data = useMemo(() => chartData(history, metric), [history, metric])
  return (
    <div
      data-docked-id={id}
      className="h-full w-full overflow-hidden rounded-lg border border-[#1f1f1f] shadow-lg shadow-black/40"
    >
      <Graph chartdata={data} fill color={color} title={`${name} · ${spec.label}`} unit={spec.unit} />
    </div>
  )
}

interface GridEventsProps {
  items: Docked[]
  onChange: (items: Docked[]) => void
}

function GridEvents({ items, onChange }: GridEventsProps) {
  const { grid } = useGridStack()
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Sync add/remove widgets imperatively when items state changes
  useEffect(() => {
    if (!grid) return

    // Add missing widgets
    const existingIds = new Set(grid.engine.nodes.map((n) => String(n.id)))
    items.forEach((item) => {
      if (!existingIds.has(item.id)) {
        grid.addWidget({
          id: item.id,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          ...({
            component: "GraphWidget",
            props: {
              id: item.id,
              nodeId: item.nodeId,
              metric: item.metric,
              name: item.name,
              color: item.color,
            },
          } as any),
        })
      }
    })

    // Remove deleted widgets
    const itemIds = new Set(items.map((i) => i.id))
    const toRemove = grid.engine.nodes.filter((n) => n.id && !itemIds.has(String(n.id)))
    toRemove.forEach((n) => {
      if (n.el) grid.removeWidget(n.el)
    })
  }, [grid, items])

  // Observe the PARENT container to resize cell heights — never the grid itself
  // (grid.el height is controlled by its children, so reading it is circular)
  useEffect(() => {
    if (!grid) return

    const container = grid.el.parentElement
    if (!container) return

    const updateCellHeight = () => {
      const height = container.clientHeight
      if (height <= 0) return
      const maxRows = Math.max(1, grid.engine.nodes.reduce((max, n) => Math.max(max, (n.y ?? 0) + (n.h ?? 1)), 1))
      const cellH = Math.floor(height / maxRows)
      grid.cellHeight(cellH)
    }

    updateCellHeight()

    const observer = new ResizeObserver(updateCellHeight)
    observer.observe(container)

    grid.on("added removed resizestop dragstop", updateCellHeight)

    return () => {
      observer.disconnect()
      grid.off("added removed resizestop dragstop")
    }
  }, [grid])

  // Propagate layout changes back to parent state
  useEffect(() => {
    if (!grid) return

    const handleChange = (
      _event: Event,
      nodes: Array<{
        id?: string
        x?: number
        y?: number
        w?: number
        h?: number
      }>,
    ) => {
      const changed = nodes
        .filter((node): node is typeof node & { id: string } => Boolean(node.id))
        .map((node) => ({
          id: node.id,
          x: node.x ?? 0,
          y: node.y ?? 0,
          w: node.w ?? 1,
          h: node.h ?? 1,
        }))

      if (changed.length) {
        onChangeRef.current(changed as Docked[])
      }
    }

    grid.on("change", handleChange)

    return () => {
      grid.off("change")
    }
  }, [grid])

  return null
}

interface DockedGraphPanelProps {
  items: Docked[]
  onChange: (items: Docked[]) => void
}

export function DockedGraphPanel({ items, onChange }: DockedGraphPanelProps) {
  const options = useMemo<GridStackOptions>(
    () => ({
      column: COLUMNS,
      cellHeight: 48,
      margin: 0,
      float: true,
      animate: true,
      resizable: {
        handles: "se,sw,ne,nw,n,s,e,w",
      },
    }),
    [],
  )

  return (
    // This div is the container we observe — it has h-full from CSS
    <div className="h-full w-full">
      <GridStack
        options={options}
        components={{
          GraphWidget: (props: Record<string, unknown>) => <GraphWidget {...(props as unknown as GraphWidgetProps)} />,
        }}
      >
        <GridEvents items={items} onChange={onChange} />
      </GridStack>
    </div>
  )
}
