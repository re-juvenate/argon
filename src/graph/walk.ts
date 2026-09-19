import { ModelTier, ServiceType, type DropContext, type DropResult, type LatencyContext, type LatencyResult, type Milliseconds, type Ratio, type ThroughputContext, type ThroughputResult } from "../types/math"
import { evaluateDrop, evaluateLatency, evaluateThroughput, throughputCapacity, throughputModel } from "../math/simulate"
import { model as asgThroughput, newASGState, type ASGState, type ASGTemplate } from "../math/asg/throughput"
import { model as asgLatency } from "../math/asg/latency"
import { model as asgDrop } from "../math/asg/drop"
import { bytes, mbps, ms, ratio, seconds } from "../math/utilities"
import { childrenOf, inputsOf, outputsOf, topoOrder } from "./graph"
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
  instances?: Map<string, Partial<NodeResult>>
}

const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => v === b[i])

export const isInstance = (graph: Graph, node: GraphNode): boolean => {
  const parent = node.parentId ? graph.nodes.find((n) => n.id === node.parentId) : undefined
  return parent?.service === ServiceType.ASG
}

export class Runtime {
  private bound = new Map<string, { deps: readonly unknown[]; b: Bound }>()
  private last = new Map<string, NodeResult>()
  tick = 0

  private bindPlain(node: GraphNode): Bound {
    const state = throughputModel(node.service).newState?.(node.config as never)
    return {
      node,
      state,
      throughput: evaluateThroughput(node.service, node.config as never, state as never),
      latency: evaluateLatency(node.service, node.config as never, state as never),
      drop: evaluateDrop(node.service, node.config as never, state as never),
    }
  }

  private template(members: Bound[], instances: Map<string, Partial<NodeResult>>): ASGTemplate {
    const caps = members.map((m) => {
      const c = throughputCapacity(m.node.service, m.node.config as never).value
      return Number.isFinite(c) ? c : 0
    })
    const total = caps.reduce((a, c) => a + c, 0)
    const w = caps.map((c) => (total > 0 ? c / total : 1 / Math.max(1, members.length)))
    const share = <C extends ThroughputContext>(ctx: C, i: number): C => ({ ...ctx, inputsMbps: ctx.inputsMbps.map((m) => mbps(m.value * w[i])) })
    const record = (id: string, patch: Partial<NodeResult>) => instances.set(id, { ...instances.get(id), ...patch })
    return {
      capacity: () => mbps(total),
      throughput: (ctx) => {
        const results = members.map((m, i) => m.throughput(share(ctx, i)))
        members.forEach((m, i) => record(m.node.id, { throughput: results[i], state: m.state }))
        const served = results.reduce((a, r) => a + r.servedMbps.value, 0)
        const capacity = results.reduce((a, r) => a + r.capacityMbps.value, 0)
        const offeredNow = ctx.inputsMbps.reduce((a, m) => a + m.value, 0)
        return {
          capacityMbps: mbps(capacity),
          offeredMbps: mbps(offeredNow),
          servedMbps: mbps(served),
          overflowMbps: mbps(Math.max(0, offeredNow - served)),
          utilization: capacity > 0 && Number.isFinite(capacity) ? offeredNow / capacity : 0,
          outputsMbps: [mbps(served)],
          model: results[0]?.model ?? ModelTier.Assumed,
          notes: results.flatMap((r) => r.notes),
        }
      },
      latency: (ctx: LatencyContext) => {
        const results = members.map((m, i) => m.latency(share(ctx, i)))
        members.forEach((m, i) => record(m.node.id, { latency: results[i] }))
        const worst = results.reduce((a, r) => (r.p99Ms.value > a.p99Ms.value ? r : a), results[0])
        return { ...worst, notes: results.flatMap((r) => r.notes) }
      },
      drop: (ctx: DropContext) => {
        const results = members.map((m, i) => m.drop(share(ctx, i)))
        members.forEach((m, i) => record(m.node.id, { drop: results[i] }))
        const rate = results.reduce((a, r, i) => a + r.dropRate.value * w[i], 0)
        const dropped = results.reduce((a, r) => a + r.droppedMbps.value, 0)
        return { ...results[0], dropRate: ratio(rate), droppedMbps: mbps(dropped), causes: results.flatMap((r) => r.causes), notes: results.flatMap((r) => r.notes) }
      },
    }
  }

  private bind(graph: Graph, node: GraphNode): Bound {
    const cached = this.bound.get(node.id)
    if (node.service !== ServiceType.ASG) {
      if (cached && same(cached.deps, [node.config])) return cached.b
      const b = this.bindPlain(node)
      this.bound.set(node.id, { deps: [node.config], b })
      return b
    }
    const children = childrenOf(graph, node.id)
    const deps = [node.config, ...children.map((c) => c.config)]
    if (cached && same(cached.deps, deps)) return cached.b
    const members = children.map((c) => this.bind(graph, c))
    const instances = new Map<string, Partial<NodeResult>>()
    const template = this.template(members, instances)
    const state = (cached?.b.state as ASGState | undefined) ?? newASGState(node.config)
    const b: Bound = {
      node,
      state,
      instances,
      throughput: asgThroughput.evaluate(node.config, state, template),
      latency: asgLatency.evaluate(node.config, state, template),
      drop: asgDrop.evaluate(node.config, state, template),
    }
    this.bound.set(node.id, { deps, b })
    return b
  }

  results(): ReadonlyMap<string, NodeResult> {
    return this.last
  }

  step(graph: Graph): ReadonlyMap<string, NodeResult> {
    this.tick += 1
    const order = topoOrder(graph).order.filter((n) => !isInstance(graph, n))
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
      const b = this.bind(graph, node)
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
      const b = this.bind(graph, node)
      const inputs = inputsOf(graph, node.id)
      const outputs = outputsOf(graph, node.id)
      const inputsMbps = inputs.map((e) => tp.get(e.from)!.outputsMbps[outputsOf(graph, e.from).findIndex((o) => o.id === e.id)] ?? mbps(0))
      const downstream = outputs.map((e) => next.get(e.to) ?? this.last.get(e.to))
      const downstreamMs: Milliseconds[] = downstream.map((d) => d?.latency.tailMs ?? ms(0))
      const downstreamDrop: Ratio[] = downstream.map((d) => d?.drop.dropRate ?? ratio(0))
      const ctx = { inputsMbps, outputCount: outputs.length, dt, tick, avgBytes: sizeOf(inputs[0]?.avgBytes), downstreamMs, downstreamDrop }
      next.set(node.id, { throughput: tp.get(node.id)!, latency: b.latency(ctx), drop: b.drop(ctx), state: b.state })
      for (const [id, partial] of b.instances ?? []) {
        if (partial.throughput && partial.latency && partial.drop) next.set(id, partial as NodeResult)
      }
    }
    this.last = next
    return next
  }
}
