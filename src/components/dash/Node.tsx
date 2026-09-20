import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { CaretDownIcon, CaretUpIcon, CreditCardIcon } from "@phosphor-icons/react/dist/ssr"
import clsx from "clsx"
import { useIsland } from "./Island"
import { Socket, useEdgeApi } from "./Edge"
import { SparkAreaChart } from "@tremor/react"
import { SocketType } from "../../types/nodes"
import Stats, { sparkData, startGraphDrag } from "./Stats"
import { Metric } from "./metrics"
import { useNodeResult } from "./Simulation"
import { graphStore, useGraph } from "#graph"

const BOTH_SOCKETS = [SocketType.Input, SocketType.Output]
const NO_SOCKETS: SocketType[] = []

export const InstanceCtx = createContext(false)

interface NodeProps {
  name: string
  color: string
  icon?: string
  graph?: any[]
  cost?: number | string
  style?: CSSProperties
  id?: string
  sockets?: SocketType[]
  draggable?: boolean
  selected?: boolean
  onSelect?: () => void
  visibleChildren?: ReactNode
  children?: ReactNode
}

export default function Node({
  name,
  color,
  icon,
  graph,
  cost,
  style,
  id,
  sockets = BOTH_SOCKETS,
  draggable = true,
  selected,
  onSelect,
  visibleChildren,
  children,
}: NodeProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const editRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const edgeApi = useEdgeApi()
  const instance = useContext(InstanceCtx)
  const shown = instance ? NO_SOCKETS : sockets
  const { result, history } = useNodeResult(id)
  const storedName = useGraph().nodes.find((n) => n.id === id)?.name
  const shownName = storedName ?? name
  const series = graph ?? (history.length > 1 ? sparkData(history) : undefined)

  const startEditing = () => {
    if (!id) return
    setDraft(shownName)
    setEditing(true)
  }

  useEffect(() => {
    if (!editing) return
    editRef.current?.focus()
    editRef.current?.select()
  }, [editing])

  const commitName = () => {
    setEditing(false)
    if (!id) return
    const next = draft.trim()
    if (next === shownName) return
    graphStore.renameNode(id, next || undefined)
  }

  const islandRef = useIsland<HTMLDivElement>({
    flow: true,
    handle: headerRef,
    enabled: draggable,
  })

  return (
    <div
      ref={islandRef}
      style={style}
      data-id={id}
      data-node
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect?.()

        if (id && edgeApi?.pending) {
          const pendingType = edgeApi.pending.dataset.socket
          const targetType = pendingType === SocketType.Output ? SocketType.Input : SocketType.Output
          const targetSocket = e.currentTarget.querySelector(`[data-socket="${targetType}"]`) as HTMLElement
          if (targetSocket) {
            edgeApi.grab(targetSocket)
          }
        }
      }}
      className={clsx(
        "w-fit min-w-48 h-auto border border-border flex flex-col bg-node pb-2 gap-2 relative mt-7",
        selected && "ring-2 ring-blueprimary",
      )}
    >
      {cost !== undefined && (
        <div className="absolute -top-6.5 left-0 bg-[#202020] border border-border border-b-0 text-gray-200 text-sm px-2 py-0.5 rounded-t flex items-center gap-1.5 select-none pointer-events-none">
          <CreditCardIcon className="size-4.5" />
          <span>${cost}</span>
        </div>
      )}

      <div
        ref={headerRef}
        style={{
          backgroundColor: color,
        }}
        className="text-xl py-1 px-4 cursor-pointer select-none hover:opacity-90 flex items-center justify-between gap-4"
        onDragStart={(e) => e.preventDefault()}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="div flex items-center justify-between gap-2">
          {icon && <img src={icon} alt="" className="size-6 shrink-0" draggable={false} />}
          {editing ? (
            <input
              ref={editRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName()
                if (e.key === "Escape") setEditing(false)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 text-left bg-transparent outline-none border-b border-white/40 text-xl"
            />
          ) : (
            <span className="flex-1 text-left cursor-text" onDoubleClick={startEditing}>
              {shownName}
            </span>
          )}
        </div>

        {children && (
          <span className="text-sm flex items-center justify-center shrink-0">
            {isOpen ? <CaretUpIcon weight="bold" /> : <CaretDownIcon weight="bold" />}
          </span>
        )}
      </div>

      <div className="flex flex-col px-2 flex-1 gap-2">
        <Stats result={result} nodeId={id} name={shownName} color={color} />

        {series && (
          <div
            draggable={!!id}
            onDragStart={(e) => id && startGraphDrag(e, { nodeId: id, metric: Metric.Served, name: shownName, color })}
            className="cursor-grab active:cursor-grabbing rounded px-1 pt-1"
          >
            <SparkAreaChart
              data={series}
              index="date"
              categories={["Semi"]}
              colors={["emerald"]}
              className="w-full flex-none
                [&_.recharts-area-curve]:stroke-2!
                [&_.recharts-area-curve]:stroke-emerald-400!
                "
            />
          </div>
        )}

        {visibleChildren}
        {/* Collapsed children stay mounted and invisible: their width keeps
            reserving space, so expanding never changes the node's width. */}
        {children && <div className={clsx("flex flex-col gap-2", !isOpen && "invisible h-0 overflow-hidden")}>{children}</div>}
      </div>

      {shown.map((type) => (
        <Socket key={type} type={type} />
      ))}
    </div>
  )
}
