import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { CheckIcon, LightningIcon, LightningSlashIcon, SparkleIcon, XIcon } from "@phosphor-icons/react/dist/ssr"
import clsx from "clsx"
import { graphStore, useGraph } from "#graph"
import { ApiError, complete, connect, currentSession } from "../../api/completion"
import { CompletionDirector, fingerprintOf, Phase } from "../../api/director"
import { installInteractionTracker, isInteracting } from "../../api/interaction"

installInteractionTracker()

const button = "grid size-10 place-items-center text-lg border border-border text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-default"
const idle = "bg-neutral-800 hover:bg-neutral-700"
const TICK_MS = 250
const ERROR_HIDE_MS = 1500
const CONNECT_RETRY_MS = 2000

export default function Completion() {
  const graph = useGraph()
  const pending = graph.nodes.some((n) => n.suggested) || graph.edges.some((e) => e.suggested || e.suggestedRemoval) || graphStore.hasSuggestion()
  const [prompt, setPrompt] = useState("")
  const [auto, setAuto] = useState(true)
  const [phase, setPhase] = useState<Phase>(Phase.Off)
  const [busy, setBusy] = useState(false)
  const [rationale, setRationale] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [connected, setConnected] = useState(() => currentSession() !== null)
  const [attempt, setAttempt] = useState(0)
  const director = useRef(new CompletionDirector())
  const promptRef = useRef(prompt)
  promptRef.current = prompt

  useEffect(() => {
    if (connected) return
    let cancelled = false
    let retry = 0
    connect()
      .then(() => !cancelled && setConnected(true))
      .catch(() => {
        if (!cancelled) retry = window.setTimeout(() => setAttempt((n) => n + 1), Math.min(30_000, CONNECT_RETRY_MS * 2 ** attempt))
      })
    return () => {
      cancelled = true
      window.clearTimeout(retry)
    }
  }, [attempt, connected])

  useEffect(() => {
    if (!failed) return
    const id = window.setTimeout(() => setFailed(false), ERROR_HIDE_MS)
    return () => window.clearTimeout(id)
  }, [failed])

  const fire = async (manual: boolean) => {
    const d = director.current
    const committed = graphStore.committed()
    const fp = fingerprintOf(committed)
    const now = Date.now()
    if (!manual && !d.shouldFire({ now, fingerprint: fp, overlay: pending, enabled: auto, visible: document.visibilityState === "visible", session: connected, interacting: isInteracting(now) })) return
    if (manual && (busy || pending)) return
    d.begin(fp, now)
    setBusy(true)
    try {
      const result = await complete(committed, promptRef.current)
      graphStore.suggest(result.added)
      setRationale(result.rationale)
      d.succeed()
    } catch (e) {
      d.fail(Date.now(), e instanceof ApiError ? e.retryAfterMs : undefined)
      setFailed(true)
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
        overlay: graphStore.hasSuggestion(),
        enabled: auto,
        visible: document.visibilityState === "visible",
        session: currentSession() !== null,
        interacting: isInteracting(),
      }
      setPhase(director.current.phase(signals))
      if (!signals.session) setConnected(false)
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

  if (failed) return null

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="flex flex-col gap-1 bg-neutral-950/90 border border-border shadow-lg shadow-black/40 backdrop-blur"
    >
      <div className="flex items-center gap-2 p-2">
        <span className="font-mono text-[13px] w-20 text-right select-none truncate text-neutral-500">{connected ? phase : "connecting"}</span>
        <input
          className="w-80 h-10 bg-neutral-900 border border-border px-2 text-gray-200 font-mono text-[14px] outline-none focus:border-blueprimary placeholder:text-neutral-600"
          placeholder="what to add…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKey}
          disabled={busy}
        />
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
      {rationale && pending && <p className="px-3 pb-2 text-[13px] leading-snug text-neutral-400 font-mono">{rationale}</p>}
    </div>
  )
}
