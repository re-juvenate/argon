import type { DropResult, LatencyResult, Milliseconds, Ratio, ThroughputResult } from "../types/math"
import { evaluateDrop, evaluateLatency, evaluateThroughput, throughputModel } from "../math/simulate"
import { bytes, mbps, ms, ratio, seconds } from "../math/utilities"
import { inputsOf, outputsOf, topoOrder } from "./graph"
import type { Graph, GraphNode } from "./types"

// Spec: .references/reduced-formulas-drop.md §5

export interface NodeResult {
  throughput: ThroughputResult
  latency: LatencyResult
  drop: DropResult
  state?: unknown
}

interface Bound {
  node: GraphNode
  state: unknown
  throughput: ReturnType<typeof evaluateThroughput>
  latency: ReturnType<typeof evaluateLatency>
  drop: ReturnType<typeof evaluateDrop>
}

export class Runtime {
  private bound = new Map<string, { config: unknown; b: Bound }>()
  private last = new Map<string, NodeResult>()
  tick = 0

  private bind(node: GraphNode): Bound {
    const cached = this.bound.get(node.id)
    if (cached && cached.config === node.config) return cached.b
    const state = throughputModel(node.service).newState?.(node.config as never)
    const b: Bound = {
      node,
      state,
      throughput: evaluateThroughput(node.service, node.config as never, state as never),
      latency: evaluateLatency(node.service, node.config as never, state as never),
      drop: evaluateDrop(node.service, node.config as never, state as never),
    }
    this.bound.set(node.id, { config: node.config, b })
    return b
  }

  results(): ReadonlyMap<string, NodeResult> {
    return this.last
  }

  step(graph: Graph): ReadonlyMap<string, NodeResult> {
    this.tick += 1
    const { order } = topoOrder(graph)
    const live = new Set(graph.nodes.map((n) => n.id))
    for (const id of this.bound.keys()) {
      if (live.has(id)) continue
      this.bound.delete(id)
      this.last.delete(id)
    }

    const dt = seconds(graph.defaults.dtSeconds)
    const tick = this.tick
    const sizeOf = (edgeBytes?: number) => {
      const b = edgeBytes ?? graph.defaults.avgBytes
      return b === undefined ? undefined : bytes(b)
    }

    const tp = new Map<string, ThroughputResult>()
    for (const node of order) {
      const b = this.bind(node)
      const inputs = inputsOf(graph, node.id)
      const inputsMbps = inputs.map((e) => {
        const up = tp.get(e.from) ?? this.last.get(e.from)?.throughput
        const idx = outputsOf(graph, e.from).findIndex((o) => o.id === e.id)
        return up?.outputsMbps[idx] ?? mbps(0)
      })
      const avgBytes = sizeOf(inputs[0]?.avgBytes)
      tp.set(node.id, b.throughput({ inputsMbps, outputCount: outputsOf(graph, node.id).length, dt, tick, avgBytes }))
    }

    const next = new Map<string, NodeResult>()
    for (const node of [...order].reverse()) {
      const b = this.bind(node)
      const inputs = inputsOf(graph, node.id)
      const outputs = outputsOf(graph, node.id)
      const inputsMbps = inputs.map((e) => tp.get(e.from)!.outputsMbps[outputsOf(graph, e.from).findIndex((o) => o.id === e.id)] ?? mbps(0))
      const downstream = outputs.map((e) => next.get(e.to) ?? this.last.get(e.to))
      const downstreamMs: Milliseconds[] = downstream.map((d) => d?.latency.tailMs ?? ms(0))
      const downstreamDrop: Ratio[] = downstream.map((d) => d?.drop.dropRate ?? ratio(0))
      const ctx = { inputsMbps, outputCount: outputs.length, dt, tick, avgBytes: sizeOf(inputs[0]?.avgBytes), downstreamMs, downstreamDrop }
      next.set(node.id, { throughput: tp.get(node.id)!, latency: b.latency(ctx), drop: b.drop(ctx), state: b.state })
    }
    this.last = next
    return next
  }
}
