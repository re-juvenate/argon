import { useMemo } from "react"

import { useGraph } from "#graph"
import { useResults, useSimulationControls } from "./Simulation"

/** Anything above this is actively dropping traffic — matches the red-edge threshold. */
const EPSILON = 1e-9

const list = "absolute left-4 bottom-4 z-50 flex flex-col gap-1.5 pointer-events-none"
const badge = "flex items-center gap-2 bg-neutral-900/90 border border-red-500/40 rounded px-2 py-1 text-xs font-mono text-white shadow-lg shadow-black/40"
const square = "size-3 shrink-0 bg-red-500"

export default function Breaking() {
  const { running } = useSimulationControls()
  const results = useResults()
  const graph = useGraph()

  // Same signal the red links use: an edge breaks when its TARGET node is
  // dropping traffic, so only nodes that actually receive an edge qualify.
  const breaking = useMemo(() => {
    const incoming = new Set(graph.edges.map((e) => e.to))
    const names = new Map(graph.nodes.map((n) => [n.id, n.name ?? n.service] as const))
    const out: Array<{ id: string; name: string; dropRate: number }> = []
    for (const id of incoming) {
      const rate = results.get(id)?.drop.dropRate.value ?? 0
      if (rate > EPSILON) out.push({ id, name: names.get(id) ?? id, dropRate: rate })
    }
    return out
  }, [graph, results])

  if (!running || breaking.length === 0) return null

  return (
    <div className={list}>
      {breaking.map((node) => (
        <div key={node.id} className={badge} title={`dropping ${(node.dropRate * 100).toFixed(2)}%`}>
          <span className={square} />
          {node.name}
        </div>
      ))}
    </div>
  )
}
