import { ModelTier, ServiceType, type DropContext, type DropResult, type LatencyContext, type LatencyResult, type Mbps, type Milliseconds, type Ratio, type ThroughputContext, type ThroughputResult } from "../types/math"
import { evaluateDrop, evaluateLatency, evaluateThroughput, throughputCapacity, throughputModel } from "../math/simulate"
import { model as asgThroughput, newASGState, type ASGState, type ASGTemplate } from "../math/asg/throughput"
import { model as asgLatency } from "../math/asg/latency"
import { model as asgDrop } from "../math/asg/drop"
import { hopLoss, hopMs, lambdaPoolShare, resolveRegion, type Placement } from "../math/region/throughput"
import { bytes, combine, mbps, ms, ratio, seconds } from "../math/utilities"
import { childrenOf, inputsOf, nodeById, outputsOf, topoOrder } from "./graph"
import type { Graph, GraphEdge, GraphNode } from "./types"

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

export const regionOf = (graph: Graph, node: GraphNode): GraphNode | undefined => {
  for (let cur: GraphNode | undefined = node; cur?.parentId; ) {
    cur = nodeById(graph, cur.parentId)
    if (cur?.service === ServiceType.Region) return cur
  }
  return undefined
}

export const placementOf = (graph: Graph, node: GraphNode): Placement => {
  const region = regionOf(graph, node)
  return region ? { region: resolveRegion(region.config) } : {}
}

export const bytesAt = (graph: Graph, id: string): number | undefined => {
  const node = nodeById(graph, id)
  if (node?.service === ServiceType.Client) return Number(node.config.avgBytes) || graph.defaults.avgBytes
  return inputsOf(graph, id)[0]?.avgBytes ?? graph.defaults.avgBytes
}

export const edgeFlow = (graph: Graph, e: GraphEdge, up: ThroughputResult | undefined): Mbps => {
  const idx = outputsOf(graph, e.from).findIndex((o) => o.id === e.id)
  const out = up?.outputsMbps[idx] ?? mbps(0)
  const from = bytesAt(graph, e.from)
  if (e.avgBytes === undefined || from === undefined || from <= 0) return out
  return mbps((out.value * e.avgBytes) / from)
}

const effectiveConfig = (graph: Graph, node: GraphNode): Record<string, unknown> => {
  if (node.service !== ServiceType.Lambda) return node.config
  const region = regionOf(graph, node)
  if (!region) return node.config
  const peers = graph.nodes.filter((n) => n.service === ServiceType.Lambda && regionOf(graph, n)?.id === region.id)
  const reserved = peers.map((n) => Number(n.config.reservedConcurrency ?? 0))
  const share = lambdaPoolShare(resolveRegion(region.config), reserved)
  return Number(node.config.reservedConcurrency ?? 0) > 0 ? node.config : { ...node.config, regionConcurrency: share }
}

export class Runtime {
  private bound = new Map<string, { deps: readonly unknown[]; b: Bound }>()
  private last = new Map<string, NodeResult>()
  tick = 0

  private bindPlain(node: GraphNode, config: Record<string, unknown>): Bound {
    const state = throughputModel(node.service).newState?.(config as never)
    return {
      node,
      state,
      throughput: evaluateThroughput(node.service, config as never, state as never),
      latency: evaluateLatency(node.service, config as never, state as never),
      drop: evaluateDrop(node.service, config as never, state as never),
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
      const config = effectiveConfig(graph, node)
      const deps = config === node.config ? [node.config] : [node.config, config.regionConcurrency]
      if (cached && same(cached.deps, deps)) return cached.b
      const b = this.bindPlain(node, config)
      this.bound.set(node.id, { deps, b })
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
    const flowOf = (e: GraphEdge, up: ThroughputResult | undefined): Mbps => edgeFlow(graph, e, up)

    const tp = new Map<string, ThroughputResult>()
    for (const node of order) {
      const b = this.bind(graph, node)
      const inputs = inputsOf(graph, node.id)
      const inputsMbps = inputs.map((e) => flowOf(e, tp.get(e.from) ?? this.last.get(e.from)?.throughput))
      const avgBytes = sizeOf(inputs[0]?.avgBytes)
      tp.set(node.id, b.throughput({ inputsMbps, outputCount: outputsOf(graph, node.id).length, dt, tick, avgBytes }))
    }

    const next = new Map<string, NodeResult>()
    for (const node of [...order].reverse()) {
      const b = this.bind(graph, node)
      const inputs = inputsOf(graph, node.id)
      const outputs = outputsOf(graph, node.id)
      const inputsMbps = inputs.map((e) => flowOf(e, tp.get(e.from)))
      const here = placementOf(graph, node)
      const downstream = outputs.map((e) => next.get(e.to) ?? this.last.get(e.to))
      const hops = outputs.map((e) => {
        const target = nodeById(graph, e.to)
        const there = target ? placementOf(graph, target) : {}
        return { ms: hopMs(here, there), loss: hopLoss(here, there) }
      })
      const downstreamMs: Milliseconds[] = downstream.map((d) => d?.latency.tailMs ?? ms(0))
      const downstreamDrop: Ratio[] = downstream.map((d) => d?.drop.dropRate ?? ratio(0))
      const ctx = { inputsMbps, outputCount: outputs.length, dt, tick, avgBytes: sizeOf(inputs[0]?.avgBytes), downstreamMs, downstreamDrop }
      const hopMean = hops.length > 0 ? hops.reduce((a, h) => a + h.ms.value, 0) / hops.length : 0
      const hopLossMean = hops.length > 0 ? ratio(hops.reduce((a, h) => a + h.loss.value, 0) / hops.length) : ratio(0)
      const latency = b.latency(ctx)
      const drop = b.drop(ctx)
      next.set(node.id, {
        throughput: tp.get(node.id)!,
        latency: {
          ...latency,
          p50Ms: ms(latency.p50Ms.value + hopMean),
          p99Ms: ms(latency.p99Ms.value + hopMean),
          tailMs: ms(latency.tailMs.value + hopMean),
          notes: hopMean > 0 ? [...latency.notes, `+${hopMean.toFixed(1)} ms region hop`] : latency.notes,
        },
        drop: hopLossMean.value > 0 ? { ...drop, dropRate: combine([drop.dropRate, hopLossMean]), notes: [...drop.notes, `+${(hopLossMean.value * 100).toFixed(2)}% region hop loss`] } : drop,
        state: b.state,
      })
      for (const [id, partial] of b.instances ?? []) {
        if (partial.throughput && partial.latency && partial.drop) next.set(id, partial as NodeResult)
      }
    }
    this.last = next
    return next
  }
}
