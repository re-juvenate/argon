import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import clsx from "clsx"

export interface MenuInput {
  value?: string | number
  type?: "text" | "number"
  placeholder?: string
  onCommit: (value: string) => void
}

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect?: () => void
  danger?: boolean
  input?: MenuInput
}

export interface MenuAt {
  x: number
  y: number
}

interface ContextMenuProps {
  at: MenuAt
  items: MenuItem[]
  onClose: () => void
}

const InputRow = ({ item, onClose }: { item: MenuItem & { input: MenuInput }; onClose: () => void }) => {
  const [value, setValue] = useState(item.input.value === undefined ? "" : String(item.input.value))
  const commit = () => item.input.onCommit(value.trim())
  return (
    <label className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs text-gray-200">
      <span className="flex items-center gap-2">
        {item.icon}
        {item.label}
      </span>
      <input
        autoFocus
        type={item.input.type ?? "number"}
        value={value}
        placeholder={item.input.placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit()
            onClose()
          }
          if (e.key === "Escape") onClose()
        }}
        onBlur={commit}
        className="w-24 bg-neutral-900 border border-border px-1.5 py-0.5 font-mono text-xs text-gray-200"
      />
    </label>
  )
}

export default function ContextMenu({ at, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("pointerdown", away, true)
    window.addEventListener("keydown", key)
    return () => {
      window.removeEventListener("pointerdown", away, true)
      window.removeEventListener("keydown", key)
    }
  }, [onClose])

  const x = Math.min(at.x, window.innerWidth - 220)
  const y = Math.min(at.y, window.innerHeight - 40 * items.length - 16)

  return createPortal(
    <div
      ref={ref}
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[1000] min-w-48 py-1 bg-node border border-border shadow-lg shadow-black/50 select-none flex flex-col"
    >
      {items.map((item) =>
        item.input ? (
          <InputRow key={item.label} item={item as MenuItem & { input: MenuInput }} onClose={onClose} />
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onSelect?.()
              onClose()
            }}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-neutral-800",
              item.danger ? "text-red-400" : "text-gray-200",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}
