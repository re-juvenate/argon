import { useMemo } from "react"

import { useGraph } from "#graph"
import { useResults, useSimulationControls } from "./Simulation"

/** Anything above this is actively dropping traffic. */
const EPSILON = 1e-9

const list = "absolute left-4 bottom-4 z-50 flex flex-col gap-1.5 pointer-events-none"
const badge = "flex items-center gap-2 bg-neutral-900/90 border border-red-500/40 rounded px-2 py-1 text-xs font-mono text-white shadow-lg shadow-black/40"
const square = "size-3 shrink-0 bg-red-500"

export default function Breaking() {
  const { running } = useSimulationControls()
  const results = useResults()
  const nodes = useGraph().nodes

  const breaking = useMemo(
    () => nodes.filter((n) => (results.get(n.id)?.drop.dropRate.value ?? 0) > EPSILON),
    [nodes, results],
  )

  if (!running || breaking.length === 0) return null

  return (
    <div className={list}>
      {breaking.map((node) => (
        <div key={node.id} className={badge} title={`dropping ${(results.get(node.id)!.drop.dropRate.value * 100).toFixed(2)}%`}>
          <span className={square} />
          {node.name ?? node.service}
        </div>
      ))}
    </div>
  )
}
