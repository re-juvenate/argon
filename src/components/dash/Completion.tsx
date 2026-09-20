import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { CheckIcon, LightningIcon, LightningSlashIcon, SparkleIcon, XIcon } from "@phosphor-icons/react/dist/ssr"
import clsx from "clsx"
import { graphStore, useGraph } from "#graph"
import { ApiError, complete, connect, currentSession } from "../../api/completion"
import { CompletionDirector, fingerprintOf, Phase } from "../../api/director"

const button = "grid size-9 place-items-center border border-border text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-default"
const idle = "bg-neutral-800 hover:bg-neutral-700"
const TICK_MS = 250

export default function Completion() {
  const graph = useGraph()
  const pending = graph.nodes.some((n) => n.suggested)
  const [prompt, setPrompt] = useState("")
  const [auto, setAuto] = useState(true)
  const [phase, setPhase] = useState<Phase>(Phase.Off)
  const [busy, setBusy] = useState(false)
  const [rationale, setRationale] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(() => currentSession() !== null)
  const director = useRef(new CompletionDirector())
  const promptRef = useRef(prompt)
  promptRef.current = prompt

  useEffect(() => {
    let cancelled = false
    connect()
      .then(() => !cancelled && setConnected(true))
      .catch((e) => !cancelled && setError(`no session: ${e instanceof Error ? e.message : String(e)}`))
    return () => {
      cancelled = true
    }
  }, [])

  const fire = async (manual: boolean) => {
    const d = director.current
    const committed = graphStore.committed()
    const fp = fingerprintOf(committed)
    const now = Date.now()
    if (!manual && !d.shouldFire({ now, fingerprint: fp, overlay: pending, enabled: auto, visible: document.visibilityState === "visible", session: connected })) return
    if (manual && (busy || pending)) return
    d.begin(fp, now)
    setBusy(true)
    setError(null)
    try {
      const result = await complete(committed, promptRef.current)
      graphStore.suggest(result.added.nodes, result.added.edges)
      setRationale(result.rationale)
      if (result.added.nodes.length === 0 && result.added.edges.length === 0) setError("nothing to add")
      d.succeed()
    } catch (e) {
      d.fail(Date.now(), e instanceof ApiError ? e.retryAfterMs : undefined)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const fireRef = useRef(fire)
  fireRef.current = fire

  useEffect(() => {
    const tick = () => {
      const signals = {
        now: Date.now(),
        fingerprint: fingerprintOf(graphStore.committed()),
        overlay: graphStore.get().nodes.some((n) => n.suggested),
        enabled: auto,
        visible: document.visibilityState === "visible",
        session: currentSession() !== null,
      }
      setPhase(director.current.phase(signals))
      if (director.current.shouldFire(signals)) void fireRef.current(false)
    }
    const id = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(id)
  }, [auto])

  const accept = () => {
    graphStore.acceptSuggestion()
    setRationale(null)
  }

  const reject = () => {
    graphStore.rejectSuggestion()
    setRationale(null)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void fire(true)
    e.stopPropagation()
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="flex flex-col items-center gap-2 p-2 w-52 bg-neutral-950/90 border border-border shadow-lg shadow-black/40 backdrop-blur"
    >
      <input
        className="w-full bg-neutral-900 border border-border px-1.5 py-1 text-gray-200 font-mono text-[11px] outline-none focus:border-blueprimary placeholder:text-neutral-600"
        placeholder="what to add…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={onKey}
        disabled={busy}
      />
      <div className="flex gap-2">
        <button type="button" title="suggest now" disabled={busy || pending} onClick={() => void fire(true)} className={clsx(button, busy ? "bg-blueprimary text-white animate-pulse" : idle)}>
          <SparkleIcon weight="bold" />
        </button>
        <button type="button" title={auto ? "auto: on" : "auto: off"} onClick={() => setAuto((v) => !v)} className={clsx(button, auto ? "bg-blueprimary/60 hover:bg-blueprimary" : idle)}>
          {auto ? <LightningIcon weight="bold" /> : <LightningSlashIcon weight="bold" />}
        </button>
        <button type="button" title="accept" disabled={!pending || busy} onClick={accept} className={clsx(button, pending ? "bg-emerald-800 hover:bg-emerald-700" : idle)}>
          <CheckIcon weight="bold" />
        </button>
        <button type="button" title="discard" disabled={!pending || busy} onClick={reject} className={clsx(button, idle)}>
          <XIcon weight="bold" />
        </button>
      </div>
      <span className="font-mono text-[10px] text-neutral-500 select-none">{connected ? phase : "connecting"}</span>
      {rationale && pending && <p className="w-full text-[10px] leading-snug text-neutral-400 font-mono">{rationale}</p>}
      {error && <p className="w-full text-[10px] leading-snug text-red-400 font-mono">{error}</p>}
    </div>
  )
}
