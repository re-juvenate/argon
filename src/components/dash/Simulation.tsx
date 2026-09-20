import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { graphStore, Runtime, type NodeResult } from "#graph"

export const HISTORY = 60

interface SimulationApi {
  running: boolean
  setRunning: (running: boolean) => void
  hz: number
  setHz: (hz: number) => void
  step: () => void
  reset: () => void
  tick: number
  results: ReadonlyMap<string, NodeResult>
  history: ReadonlyMap<string, readonly NodeResult[]>
}

const SimulationCtx = createContext<SimulationApi | null>(null)

const EMPTY_HISTORY: readonly NodeResult[] = []

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false)
  const [hz, setHz] = useState(1)
  const runtime = useRef(new Runtime())
  const historyRef = useRef(new Map<string, NodeResult[]>())
  const [results, setResults] = useState<ReadonlyMap<string, NodeResult>>(() => new Map())
  const [history, setHistory] = useState<ReadonlyMap<string, readonly NodeResult[]>>(() => new Map())

  const step = useCallback(() => {
    const next = new Map(runtime.current.step(graphStore.committed()))
    const store = historyRef.current
    for (const id of store.keys()) if (!next.has(id)) store.delete(id)
    for (const [id, result] of next) {
      const list = store.get(id) ?? []
      list.push(result)
      if (list.length > HISTORY) list.splice(0, list.length - HISTORY)
      store.set(id, list)
    }
    setResults(next)
    setHistory(new Map(Array.from(store, ([id, list]) => [id, [...list]])))
  }, [])

  const reset = useCallback(() => {
    runtime.current = new Runtime()
    historyRef.current.clear()
    setRunning(false)
    setResults(new Map())
    setHistory(new Map())
  }, [])

  useEffect(() => {
    if (!running) return
    const timer = setInterval(step, 1000 / hz)
    return () => clearInterval(timer)
  }, [running, hz, step])

  const api = useMemo<SimulationApi>(
    () => ({ running, setRunning, hz, setHz, step, reset, tick: runtime.current.tick, results, history }),
    [running, hz, step, reset, results, history],
  )

  return <SimulationCtx.Provider value={api}>{children}</SimulationCtx.Provider>
}

export const useSimulationControls = () => {
  const api = useContext(SimulationCtx)
  if (!api) throw new Error("useSimulationControls must be used inside SimulationProvider")
  return api
}

const EMPTY_RESULTS: ReadonlyMap<string, NodeResult> = new Map()

export const useResults = (): ReadonlyMap<string, NodeResult> => useContext(SimulationCtx)?.results ?? EMPTY_RESULTS

export const useNodeResult = (id?: string): { result?: NodeResult; history: readonly NodeResult[] } => {
  const api = useContext(SimulationCtx)
  if (!api || !id) return { result: undefined, history: EMPTY_HISTORY }
  return { result: api.results.get(id), history: api.history.get(id) ?? EMPTY_HISTORY }
}
