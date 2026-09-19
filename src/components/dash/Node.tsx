import { useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react"
import { CaretDownIcon, CaretUpIcon, CreditCardIcon } from "@phosphor-icons/react/dist/ssr"
import clsx from "clsx"
import { useIsland } from "./Island"
import { Socket } from "./Edge"
import { SparkAreaChart } from "@tremor/react"

interface NodeProps {
  name: string
  color: string
  icon?: string
  graph?: any[]
  cost?: number
  style?: CSSProperties
  id?: string
  selected?: boolean
  onSelect?: () => void
  visibleChildren?: ReactNode
  children?: ReactNode
}

interface GraphPayload {
  data: unknown[]
  color: string
}

export default function Node({
  name,
  color,
  icon,
  graph,
  cost,
  style,
  id,
  selected,
  onSelect,
  visibleChildren,
  children,
}: NodeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)

  const islandRef = useIsland<HTMLDivElement>({
    flow: true,
    handle: headerRef,
  })

  return (
    <div
      ref={islandRef}
      style={style}
      data-id={id}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect?.()
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
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="div flex items-center justify-between gap-2">
          {icon && <img src={icon} alt="" className="size-6 shrink-0" draggable={false} />}
          <span className="flex-1 text-left">{name}</span>
        </div>

        {children && (
          <span className="text-sm flex items-center justify-center shrink-0">
            {isOpen ? <CaretUpIcon weight="bold" /> : <CaretDownIcon weight="bold" />}
          </span>
        )}
      </div>

      <div className="flex flex-col px-2 flex-1 gap-2">
        {graph && (
          <div
            draggable
            onDragStart={(e: DragEvent) => {
              const payload: GraphPayload = { data: graph, color }
              e.dataTransfer.setData("text/graph", JSON.stringify(payload))
              e.dataTransfer.effectAllowed = "copy"
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <SparkAreaChart
              data={graph}
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
        {children && (
          <div
            className={clsx(
              "flex flex-col gap-2",
              !isOpen && "invisible h-0 overflow-hidden",
            )}
          >
            {children}
          </div>
        )}
      </div>

      <Socket />
    </div>
  )
}
