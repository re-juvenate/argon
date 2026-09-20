import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { MagnifyingGlass, CaretRight } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cnfast"

export interface AddMenuItem {
  label: string
  icon?: string
  category: string
  onSelect: () => void
}

interface BlenderAddMenuProps {
  at: { x: number; y: number }
  items: AddMenuItem[]
  onClose: () => void
}

const CATEGORY_ORDER = ["Compute", "Network", "Storage", "Database", "Integration", "Actors", "Frames"]

export default function BlenderAddMenu({ at, items, onClose }: BlenderAddMenuProps) {
  const [search, setSearch] = useState("")
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  // flat selection cursor for keyboard nav
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener("mousedown", onDown)
    return () => window.removeEventListener("mousedown", onDown)
  }, [onClose])

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim()
    const result: Record<string, AddMenuItem[]> = {}
    items.forEach((item) => {
      if (q && !item.label.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) return
      const cat = item.category
      if (!result[cat]) result[cat] = []
      result[cat].push(item)
    })
    return result
  }, [items, search])

  const isSearching = search.trim().length > 0

  // flat list for keyboard nav
  const flatItems = useMemo<AddMenuItem[]>(() => {
    if (isSearching) return Object.values(grouped).flat()
    // In category mode, flatten in category order for enter-key
    return CATEGORY_ORDER.filter((c) => grouped[c]).flatMap((c) => grouped[c] ?? [])
  }, [grouped, isSearching])

  // Reset cursor when list changes
  useEffect(() => { setCursor(0) }, [flatItems])

  const commit = useCallback((item: AddMenuItem) => {
    item.onSelect()
    onClose()
  }, [onClose])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, flatItems.length - 1)); return }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return }
    if (e.key === "Enter") {
      e.preventDefault()
      const item = flatItems[cursor]
      if (item) commit(item)
    }
  }

  // Smart position: flip if too close to right/bottom edge
  const menuLeft = at.x + 248 > window.innerWidth ? at.x - 248 : at.x
  const menuTop  = at.y + 420 > window.innerHeight ? at.y - 420 : at.y

  return createPortal(
    <div
      ref={menuRef}
      style={{ left: menuLeft, top: menuTop }}
      onKeyDown={handleKey}
      className="fixed z-[9999] w-60 rounded bg-[#1c1c1c] border border-[#333] shadow-2xl shadow-black/70 py-1 select-none"
    >
      {/* Title */}
      <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">Add</div>

      {/* Search */}
      <div className="px-2 pb-2">
        <div className="flex items-center gap-1.5 px-2 h-7 rounded bg-[#2a2a2a] border border-[#3a3a3a] focus-within:border-blue-500 transition-colors">
          <MagnifyingGlass size={12} className="text-neutral-500 shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 outline-none"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-2 mb-1 border-t border-[#2a2a2a]" />

      {/* Items */}
      <div className="max-h-80 overflow-y-auto overflow-x-hidden">
        {isSearching ? (
          // Flat search results with keyboard cursor
          flatItems.length > 0
            ? flatItems.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => commit(item)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-neutral-200 transition-colors",
                    cursor === i ? "bg-[#3a7cc1]" : "hover:bg-[#2a2a2a]",
                  )}
                >
                  {item.icon && <img src={item.icon} alt="" className="w-4 h-4 object-contain shrink-0" />}
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-[10px] text-neutral-500 shrink-0">{item.category}</span>
                </button>
              ))
            : <div className="px-3 py-3 text-xs text-neutral-500 text-center">No results</div>
        ) : (
          // Grouped categories — hover opens a flyout OUTSIDE the scroll container
          CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => {
            const catItems = grouped[cat] ?? []
            const isHovered = hoveredCategory === cat
            const firstInCat = flatItems.indexOf(catItems[0])
            return (
              <div
                key={cat}
                className="relative"
                onMouseEnter={() => setHoveredCategory(cat)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-sm text-neutral-200 transition-colors",
                    isHovered ? "bg-[#3a7cc1]" : "hover:bg-[#2a2a2a]",
                  )}
                >
                  <span>{cat}</span>
                  <CaretRight size={11} className="text-neutral-400 shrink-0" />
                </button>

                {/* Flyout: rendered via portal so it never causes horizontal scroll */}
                {isHovered && (
                  <FlyoutSubmenu
                    items={catItems}
                    parentRef={menuRef}
                    categoryLabel={cat}
                    onSelect={commit}
                    cursorOffset={firstInCat}
                    cursor={cursor}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>,
    document.body,
  )
}

interface FlyoutProps {
  items: AddMenuItem[]
  parentRef: React.RefObject<HTMLDivElement | null>
  categoryLabel: string
  onSelect: (item: AddMenuItem) => void
  cursorOffset: number
  cursor: number
}

function FlyoutSubmenu({ items, parentRef, categoryLabel, onSelect }: FlyoutProps) {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!parentRef.current) return
    const parentRect = parentRef.current.getBoundingClientRect()
    // Find the button for this category inside the parent
    const btn = parentRef.current.querySelector(`button[data-cat="${categoryLabel}"]`) as HTMLElement | null
    const btnTop = btn ? btn.getBoundingClientRect().top : parentRect.top
    const left = parentRect.right + 4
    const top = btnTop
    // Flip up if needed
    const adjTop = top + items.length * 30 > window.innerHeight ? window.innerHeight - items.length * 30 - 8 : top
    setPos({ top: adjTop, left })
  }, [parentRef, categoryLabel, items.length])

  return createPortal(
    <div
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-[10000] w-52 rounded bg-[#1c1c1c] border border-[#333] shadow-2xl shadow-black/70 py-1"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onSelect(item)}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-neutral-200 hover:bg-[#3a7cc1] transition-colors"
        >
          {item.icon && <img src={item.icon} alt="" className="w-4 h-4 object-contain shrink-0" />}
          <span className="text-left">{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
