import { ServiceType } from "../types/math"
import { THROUGHPUT_MODELS } from "../math/simulate"
import { resolve } from "../math/utilities"
import { graphSchema, type Graph, type GraphEdge, type GraphNode, type Position } from "./types"

export function addNode(graph: Graph, node: GraphNode): Graph {
  if (graph.nodes.some((n) => n.id === node.id)) return updateNode(graph, node.id, node)
  return { ...graph, nodes: [...graph.nodes, node] }
}

export function updateNode(graph: Graph, id: string, patch: Partial<Omit<GraphNode, "id">>): Graph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }
}

const hasField = (service: ServiceType, field: string): boolean => field in THROUGHPUT_MODELS[service].defaults

function inheritRegion(graph: Graph, id: string, code: unknown): Graph {
  const node = nodeById(graph, id)
  if (!node || !hasField(node.service, "region")) return graph
  return updateNode(graph, id, { config: { ...node.config, region: code } })
}

export function setConfig(graph: Graph, id: string, config: Record<string, unknown>): Graph {
  const next = updateNode(graph, id, { config })
  const node = nodeById(graph, id)
  if (node?.service !== ServiceType.Region) return next
  return childrenOf(next, id).reduce((g, child) => inheritRegion(g, child.id, config.code), next)
}

export function setPosition(graph: Graph, id: string, position: Position): Graph {
  return updateNode(graph, id, { position })
}

export const ASG_MEMBERS = new Set<ServiceType>([ServiceType.EC2, ServiceType.ECS])

export function setParent(graph: Graph, id: string, parentId: string | null): Graph {
  const parent = parentId === null ? undefined : nodeById(graph, parentId)
  if (parentId !== null && (parentId === id || !parent)) return graph
  if (parent?.service === ServiceType.ASG && !ASG_MEMBERS.has(nodeById(graph, id)?.service as ServiceType)) return graph
  const detached = parent?.service === ServiceType.ASG ? { ...graph, edges: graph.edges.filter((e) => e.from !== id && e.to !== id) } : graph
  const next = updateNode(detached, id, { parentId: parentId ?? undefined })
  return parent?.service === ServiceType.Region ? inheritRegion(next, id, parent.config.code) : next
}

export function place(graph: Graph, id: string, position: Position, parentId: string | null): Graph {
  const parented = setParent(graph, id, parentId)
  if (parented === graph) return graph
  return nodeById(parented, id) ? setPosition(parented, id, position) : parented
}

export const childrenOf = (graph: Graph, id: string): GraphNode[] => graph.nodes.filter((n) => n.parentId === id)

export function removeNode(graph: Graph, id: string): Graph {
  const gone = new Set<string>([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const n of graph.nodes) if (n.parentId && gone.has(n.parentId) && !gone.has(n.id)) grew = gone.add(n.id) !== undefined
  }
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => !gone.has(n.id)),
    edges: graph.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to)),
  }
}

export const hasEdge = (graph: Graph, from: string, to: string): boolean =>
  graph.edges.some((e) => e.from === from && e.to === to)

export function connect(graph: Graph, from: string, to: string, id = crypto.randomUUID()): Graph {
  if (from === to || hasEdge(graph, from, to)) return graph
  if (!graph.nodes.some((n) => n.id === from) || !graph.nodes.some((n) => n.id === to)) return graph
  return { ...graph, edges: [...graph.edges, { id, from, to }] }
}

export function updateEdge(graph: Graph, id: string, patch: Partial<Omit<GraphEdge, "id">>): Graph {
  return { ...graph, edges: graph.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
}

export function removeEdge(graph: Graph, id: string): Graph {
  return { ...graph, edges: graph.edges.filter((e) => e.id !== id) }
}

export function setDefaults(graph: Graph, patch: Partial<Graph["defaults"]>): Graph {
  return { ...graph, defaults: { ...graph.defaults, ...patch } }
}

export const nodeById = (graph: Graph, id: string): GraphNode | undefined => graph.nodes.find((n) => n.id === id)

export const inputsOf = (graph: Graph, id: string): GraphEdge[] => graph.edges.filter((e) => e.to === id)
export const outputsOf = (graph: Graph, id: string): GraphEdge[] => graph.edges.filter((e) => e.from === id)

export function configOf<T extends ServiceType>(node: GraphNode & { service: T }): (typeof THROUGHPUT_MODELS)[T]["defaults"] {
  const defaults = THROUGHPUT_MODELS[node.service].defaults as Record<string, unknown>
  return resolve(defaults, node.config) as (typeof THROUGHPUT_MODELS)[T]["defaults"]
}

export function topoOrder(graph: Graph): { order: GraphNode[]; backEdges: GraphEdge[] } {
  const indegree = new Map(graph.nodes.map((n) => [n.id, 0]))
  for (const e of graph.edges) indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1)
  const ready = graph.nodes.filter((n) => indegree.get(n.id) === 0)
  const order: GraphNode[] = []
  const seen = new Set<string>()
  while (ready.length > 0 || seen.size < graph.nodes.length) {
    if (ready.length === 0) {
      const stuck = graph.nodes.find((n) => !seen.has(n.id))
      if (!stuck) break
      ready.push(stuck)
    }
    const n = ready.shift()!
    if (seen.has(n.id)) continue
    seen.add(n.id)
    order.push(n)
    for (const e of outputsOf(graph, n.id)) {
      const d = (indegree.get(e.to) ?? 1) - 1
      indegree.set(e.to, d)
      if (d === 0) {
        const next = nodeById(graph, e.to)
        if (next && !seen.has(next.id)) ready.push(next)
      }
    }
  }
  const index = new Map(order.map((n, i) => [n.id, i]))
  const backEdges = graph.edges.filter((e) => (index.get(e.from) ?? 0) >= (index.get(e.to) ?? 0))
  return { order, backEdges }
}

export const committed = (graph: Graph): Graph =>
  graph.nodes.some((n) => n.suggested) || graph.edges.some((e) => e.suggested)
    ? { ...graph, nodes: graph.nodes.filter((n) => !n.suggested), edges: graph.edges.filter((e) => !e.suggested) }
    : graph

export function suggest(graph: Graph, nodes: GraphNode[], edges: GraphEdge[]): Graph {
  const base = committed(graph)
  const ids = new Set(base.nodes.map((n) => n.id))
  const fresh = nodes.filter((n) => !ids.has(n.id)).map((n) => ({ ...n, suggested: true }))
  for (const n of fresh) ids.add(n.id)
  const pairs = new Set(base.edges.map((e) => `${e.from}>${e.to}`))
  const links = edges
    .filter((e) => e.from !== e.to && ids.has(e.from) && ids.has(e.to) && !pairs.has(`${e.from}>${e.to}`))
    .map((e) => ({ ...e, suggested: true }))
  return { ...base, nodes: [...base.nodes, ...fresh], edges: [...base.edges, ...links] }
}

export const acceptSuggestion = (graph: Graph): Graph => ({
  ...graph,
  nodes: graph.nodes.map((n) => (n.suggested ? { ...n, suggested: undefined } : n)),
  edges: graph.edges.map((e) => (e.suggested ? { ...e, suggested: undefined } : e)),
})

export const toJSON = (graph: Graph): string => JSON.stringify(committed(graph), null, 2)

export const fromJSON = (json: string): Graph => graphSchema.parse(JSON.parse(json)) as Graph
