import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { ServiceType } from "../types/math"
import * as ops from "./graph"
import { THROUGHPUT_MODELS } from "../math/simulate"
import { emptyGraph, type GlobalDefaults, type Graph, type Position, type Suggestion } from "./types"
import { Runtime, type NodeResult } from "./walk"

type Listener = () => void

class GraphStore {
  private graph: Graph = emptyGraph()
  private listeners = new Set<Listener>()

  get = (): Graph => this.graph

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  private set(next: Graph) {
    if (next === this.graph) return
    this.graph = next
    for (const l of this.listeners) l()
  }

  load = (graph: Graph) => this.set(graph)
  reset = (defaults?: Partial<GlobalDefaults>) => this.set(emptyGraph(defaults))
  setDefaults = (patch: Partial<GlobalDefaults>) => this.set(ops.setDefaults(this.graph, patch))

  registerNode = (id: string, service: ServiceType, config: Record<string, unknown>, position?: Position, parentId?: string) => {
    const existing = ops.nodeById(this.graph, id)
    if (!existing) return this.set(ops.addNode(this.graph, { id, service, config, position, parentId }))
    if (position) this.set(ops.setPosition(this.graph, id, position))
  }
  setConfig = (id: string, config: Record<string, unknown>) => this.set(ops.setConfig(this.graph, id, config))
  renameNode = (id: string, name: string | undefined) => this.set(ops.updateNode(this.graph, id, { name: name?.trim() || undefined }))
  setPosition = (id: string, position: Position) => this.set(ops.setPosition(this.graph, id, position))
  setParent = (id: string, parentId: string | null) => this.set(ops.setParent(this.graph, id, parentId))
  place = (id: string, position: Position, parentId: string | null) => this.set(ops.place(this.graph, id, position, parentId))
  addNode = (service: ServiceType, position: Position, parentId: string | null, id = crypto.randomUUID()) => {
    const config = { ...THROUGHPUT_MODELS[service].defaults } as Record<string, unknown>
    this.set(ops.place(ops.addNode(this.graph, { id, service, config, position }), id, position, parentId))
    return id
  }
  removeNode = (id: string) => this.set(ops.removeNode(this.graph, id))

  connect = (from: string, to: string) => this.set(ops.connect(this.graph, from, to))
  removeEdge = (id: string) => this.set(ops.removeEdge(this.graph, id))
  setEdgeBytes = (id: string, avgBytes: number | undefined) => this.set(ops.updateEdge(this.graph, id, { avgBytes }))

  private originals: ops.Originals = new Map()

  hasSuggestion = () => ops.hasSuggestion(this.graph, this.originals)
  committed = () => ops.committed(this.graph, this.originals)
  suggest = (s: Suggestion) => {
    const next = ops.suggest(this.graph, this.originals, s)
    this.originals = next.originals
    this.set(next.graph)
  }
  acceptSuggestion = () => {
    this.originals = new Map()
    this.set(ops.acceptSuggestion(this.graph))
  }
  rejectSuggestion = () => {
    const next = ops.committed(this.graph, this.originals)
    this.originals = new Map()
    this.set(next)
  }

  toJSON = () => ops.toJSON(this.graph, this.originals)
  fromJSON = (json: string) => {
    this.originals = new Map()
    this.set(ops.fromJSON(json))
  }
}

export const graphStore = new GraphStore()

export const useGraph = (): Graph => useSyncExternalStore(graphStore.subscribe, graphStore.get, graphStore.get)

export function useNodeConfig<C extends object>(service: ServiceType, defaults: Required<C>, id?: string): [C, (patch: Partial<C>) => void, string] {
  const generated = useId()
  const nodeId = id ?? generated
  const graph = useGraph()
  const node = graph.nodes.find((n) => n.id === nodeId)
  const config = useMemo(() => (node?.config as C | undefined) ?? (defaults as C), [node?.config, defaults])
  useEffect(() => graphStore.registerNode(nodeId, service, defaults), [nodeId, service, defaults])
  const update = useCallback(
    (patch: Partial<C>) => {
      const current = (graphStore.get().nodes.find((n) => n.id === nodeId)?.config as C | undefined) ?? defaults
      graphStore.setConfig(nodeId, { ...current, ...patch })
    },
    [nodeId, defaults],
  )
  return [config, update, nodeId]
}

export function useSimulation(running: boolean, hz = 1): ReadonlyMap<string, NodeResult> {
  const runtime = useRef(new Runtime())
  const [results, setResults] = useState<ReadonlyMap<string, NodeResult>>(() => new Map())
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setResults(new Map(runtime.current.step(graphStore.get()))), 1000 / hz)
    return () => clearInterval(timer)
  }, [running, hz])
  return results
}
