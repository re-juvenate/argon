import type { ReactNode } from "react"
import { ArrowCounterClockwiseIcon, PauseIcon, PlayIcon, SkipForwardIcon } from "@phosphor-icons/react/dist/ssr"
import clsx from "clsx"
import { graphStore, useGraph } from "#graph"
import { useSimulationControls } from "./Simulation"

const button = "grid size-9 place-items-center border border-border text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-default"
const idle = "bg-neutral-800 hover:bg-neutral-700"
const input = "w-14 bg-neutral-900 border border-border px-1 py-0.5 text-center text-gray-200 font-mono text-[11px] outline-none focus:border-blueprimary"

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex flex-col items-center gap-0.5 text-[10px] uppercase tracking-wide text-neutral-500 select-none">
    {label}
    {children}
  </label>
)

export default function SimulationBar() {
  const { running, setRunning, hz, setHz, step, reset, tick } = useSimulationControls()
  const { defaults } = useGraph()

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="flex flex-col items-center gap-2 p-2 bg-neutral-950/90 border border-border shadow-lg shadow-black/40 backdrop-blur"
    >
      <button
        type="button"
        title={running ? "pause" : "run"}
        onClick={() => setRunning(!running)}
        className={clsx(button, running ? "bg-blueprimary text-white" : idle)}
      >
        {running ? <PauseIcon weight="bold" /> : <PlayIcon weight="bold" />}
      </button>

      <button type="button" title="step" disabled={running} onClick={step} className={clsx(button, idle)}>
        <SkipForwardIcon weight="bold" />
      </button>

      <button type="button" title="reset" onClick={reset} className={clsx(button, idle)}>
        <ArrowCounterClockwiseIcon weight="bold" />
      </button>

      <span className="font-mono text-[10px] text-neutral-500 select-none">t={tick}</span>

      <div className="h-px w-full bg-border" />

      <Field label="hz">
        <input className={input} type="number" min={0.1} max={30} step={0.5} value={hz} onChange={(e) => setHz(Math.max(0.1, Number(e.target.value) || 1))} />
      </Field>

      <Field label="dt s">
        <input className={input} type="number" min={0.1} step={0.5} value={defaults.dtSeconds} onChange={(e) => graphStore.setDefaults({ dtSeconds: Math.max(0.1, Number(e.target.value) || 1) })} />
      </Field>

      <Field label="bytes">
        <input className={input} type="number" min={0} step={64} value={defaults.avgBytes ?? ""} placeholder="model" onChange={(e) => graphStore.setDefaults({ avgBytes: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })} />
      </Field>
    </div>
  )
}
