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

export function setConfig(graph: Graph, id: string, config: Record<string, unknown>): Graph {
  return updateNode(graph, id, { config })
}

export function setPosition(graph: Graph, id: string, position: Position): Graph {
  return updateNode(graph, id, { position })
}

export function removeNode(graph: Graph, id: string): Graph {
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => n.id !== id),
    edges: graph.edges.filter((e) => e.from !== id && e.to !== id),
  }
}

export const hasEdge = (graph: Graph, from: string, to: string): boolean =>
  graph.edges.some((e) => e.from === from && e.to === to)

export function connect(graph: Graph, from: string, to: string, id = crypto.randomUUID()): Graph {
  if (from === to || hasEdge(graph, from, to)) return graph
  if (!graph.nodes.some((n) => n.id === from) || !graph.nodes.some((n) => n.id === to)) return graph
  return { ...graph, edges: [...graph.edges, { id, from, to }] }
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

export const toJSON = (graph: Graph): string => JSON.stringify(graph, null, 2)

export const fromJSON = (json: string): Graph => graphSchema.parse(JSON.parse(json)) as Graph
