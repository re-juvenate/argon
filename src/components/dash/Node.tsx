import { useRef, useState, type CSSProperties, type ReactNode } from "react"
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr"
import clsx from "clsx"
import { useIsland } from "./Island"
import { Socket } from "./Edge"
import { SparkAreaChart } from "@tremor/react"

interface NodeProps {
  name: string
  color: string
  graph?: any[]
  style?: CSSProperties
  id?: string
  selected?: boolean
  onSelect?: () => void
  visibleChildren?: ReactNode
  children?: ReactNode
}

export default function Node({
  name,
  color,
  graph,
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
        "w-fit min-w-48 h-auto border border-border flex flex-col bg-node pb-2 gap-2 relative",
        selected && "ring-2 ring-blueprimary",
      )}
    >
      <div
        ref={headerRef}
        style={{
          backgroundColor: color,
        }}
        className="text-xl py-1 px-4 cursor-pointer select-none hover:opacity-90 flex items-center justify-between gap-2"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{name}</span>

        {children && (
          <span className="text-sm">{isOpen ? <CaretUpIcon /> : <CaretDownIcon />}</span>
        )}
      </div>

      <div className="flex flex-col px-2 flex-1 gap-2">
        {graph && (
          <SparkAreaChart
            data={graph}
            index="date"
            categories={["Semi"]}
            colors={["emerald"]}
            className="w-full flex-none
              [&_.recharts-area-curve]:stroke-2!
              [&_.recharts-area-curve]:stroke-emerald-400!"
          />
        )}

        {visibleChildren}
        {children && isOpen && <div className="flex flex-col gap-2">{children}</div>}
      </div>

      <Socket />
    </div>
  )
}
