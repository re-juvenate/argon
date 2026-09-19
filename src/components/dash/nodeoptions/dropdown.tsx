import React, { useState, useRef, useEffect, useId, useMemo } from "react"
import { cn } from "cnfast"

export interface Option {
  name: string
  onSelect?: () => void
}

interface BlenderDropdownProps {
  label?: string
  options?: Option[]
}

export default function Dropdown({ label = "Options", options = [] }: BlenderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<Option | undefined>(options[0])
  const [searchQuery, setSearchQuery] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const currentOption = selectedOption || options[0]

  // Longest option name, kept in flow via the invisible sizer below so the
  // node's w-fit sizing accounts for the open listbox (absolute elements
  // contribute no width on their own).
  const longestName = useMemo(
    () => options.reduce((widest, option) => (option.name.length > widest.length ? option.name : widest), ""),
    [options],
  )

  const filteredOptions = useMemo(() => {
    return options.filter((option) => option.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [options, searchQuery])

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus()
    } else {
      setSearchQuery("")
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false)
      dropdownRef.current?.querySelector("button")?.focus()
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      if (
        document.activeElement === searchInputRef.current &&
        (e.key === "Enter" || e.key === " ")
      ) {
        return
      }

      if (!isOpen) {
        e.preventDefault()
        setIsOpen(true)
        return
      }

      if (filteredOptions.length === 0) return

      const currentIndex = filteredOptions.indexOf(currentOption)
      let nextIndex = currentIndex

      if (e.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % filteredOptions.length
        e.preventDefault()
      } else if (e.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + filteredOptions.length) % filteredOptions.length
        e.preventDefault()
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleSelect(currentOption)
      }

      if (nextIndex !== currentIndex) {
        setSelectedOption(filteredOptions[nextIndex])
      }
    }
  }

  const handleSelect = (option: Option) => {
    setSelectedOption(option)
    setIsOpen(false)
    option.onSelect?.()
    dropdownRef.current?.querySelector("button")?.focus()
  }

  return (
    <div ref={dropdownRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Invisible width sizer: text matches the trigger/listbox styling. */}
      <div
        aria-hidden
        className="h-0 overflow-hidden text-sm font-sans tracking-wide whitespace-nowrap pl-3 pr-9"
      >
        {longestName}
      </div>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center justify-between w-full h-7 px-3 border rounded tracking-wide font-sans text-sm transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-[#477cb9]",
          isOpen
            ? "bg-[#3d6ca4] border-[#2a4d77] text-white"
            : "bg-[#2e2e2e] border-[#151515] hover:bg-[#353535] text-[#e0e0e0]",
        )}
      >
        <span>{currentOption?.name}</span>

        <svg
          className={cn("w-3 h-3 transition-colors", isOpen ? "text-white" : "text-[#a3a3a3]")}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 w-full mt-1 bg-[#181818] border border-[#101010] rounded shadow-2xl z-50 flex flex-col max-h-[50vh]"
        >
          <div className="flex flex-col border-b border-[#282828] p-1 gap-1 sticky top-0 bg-[#181818] z-10">
            <div className="px-2 py-0.5 text-xs font-sans text-[#666666] tracking-wide cursor-default">
              {label}
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-6 px-2 text-xs font-sans bg-[#252525] border border-[#151515] rounded text-[#d0d0d0] focus:outline-none focus:border-[#477cb9]"
            />
          </div>

          <div
            className="flex-1 overflow-y-auto py-1 flex flex-col gap-px scrollbar-thin"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#444444 #181818",
            }}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option === currentOption

                return (
                  <button
                    key={option.name}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      "flex items-center text-left h-7 px-4 text-sm font-sans tracking-wide outline-none transition-colors duration-75 text-[#d0d0d0] hover:bg-[#477cb9] hover:text-white flex-shrink-0",
                      isSelected && "bg-[#3d6ca4] text-white mx-0.5 rounded w-[calc(100%-4px)]",
                    )}
                  >
                    {option.name}
                  </button>
                )
              })
            ) : (
              <div className="px-4 py-2 text-xs text-[#666666] font-sans italic cursor-default">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
