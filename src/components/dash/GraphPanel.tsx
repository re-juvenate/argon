import { useEffect, useMemo, useRef } from "react"
import { GridStack, useGridStack } from "gridstack/dist/react"
import type { GridStackOptions } from "gridstack"
import "gridstack/dist/gridstack.css"

import Graph, { type ChartDataItem } from "./nodeoptions/graph"

export interface Docked {
  id: string
  data: ChartDataItem[]
  x: number
  y: number
  w: number
  h: number
  color?: string
}

const makeChartData = (values: number[]): ChartDataItem[] =>
  values.map((Throughput, i) => ({
    time: String(i),
    Throughput,
    Time: i,
  }))

export const DEFAULT_DOCKED: Docked[] = [
  {
    id: "graph-1",
    x: 1,
    y: 1,
    w: 7,
    h: 8,
    color: "#693cc5",
    data: makeChartData([2890, 2756, 3322, 3470, 3475, 3129, 3560, 3402]),
  },
  {
    id: "graph-2",
    x: 8,
    y: 1,
    w: 7,
    h: 8,
    color: "#e66d00",
    data: makeChartData([1240, 1580, 1420, 1930, 2210, 2050, 2480, 2760]),
  },
]

interface GraphWidgetProps {
  data: ChartDataItem[]
  color?: string
}

function GraphWidget({ data, color }: GraphWidgetProps) {
  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-[#1f1f1f] shadow-lg shadow-black/40">
      <Graph chartdata={data} fill color={color} />
    </div>
  )
}

interface GridEventsProps {
  onChange: (items: Docked[]) => void
}

function GridEvents({ onChange }: GridEventsProps) {
  const { grid } = useGridStack()
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!grid) return

    const updateBounds = () => {
      const height = grid.el.clientHeight
      if (height <= 0) return

      // Find the maximum logical row any widget reaches
      const maxRows = Math.max(1, grid.engine.nodes.reduce((max, n) => Math.max(max, (n.y ?? 0) + (n.h ?? 1)), 1))

      // Dynamically size the cells so they perfectly fill the visible height
      const newCellHeight = Math.floor(height / maxRows)
      grid.cellHeight(newCellHeight)
    }

    updateBounds()

    const observer = new ResizeObserver(updateBounds)
    observer.observe(grid.el)

    grid.on("added removed change", updateBounds)

    return () => {
      observer.disconnect()
      grid.off("added removed change", updateBounds)
    }
  }, [grid])

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
  const gridRef = useRef<HTMLDivElement>(null)

  const options = useMemo<GridStackOptions>(
    () => ({
      column: 24,
      cellHeight: 48,
      margin: 0,
      float: true,
      animate: true,
      draggable: {
        appendTo: "body",
      },
      resizable: {
        handles: "all",
      },
      children: items.map((item) => ({
        id: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        component: "GraphWidget",
        props: {
          data: item.data,
          color: item.color,
        },
      })),
    }),
    [items],
  )

  return (
    <div ref={gridRef} className="grid-stack h-full w-full">
      <GridStack
        options={options}
        components={{
          GraphWidget,
        }}
      >
        <GridEvents onChange={onChange} />
      </GridStack>
    </div>
  )
}
