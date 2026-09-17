import React, { useState, useRef, useEffect, useId } from "react";
import { cn } from "cnfast";

export interface Option {
  name: string;
  onSelect?: () => void;
}

interface BlenderDropdownProps {
  label?: string;
  options?: Option[];
}

export default function Dropdown({ label = "Options", options = [] }: BlenderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<Option | undefined>(options[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const currentOption = selectedOption || options[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      dropdownRef.current?.querySelector("button")?.focus();
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      const currentIndex = options.indexOf(currentOption);
      let nextIndex = currentIndex;

      if (e.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % options.length;
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + options.length) % options.length;
        e.preventDefault();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect(currentOption);
      }

      if (nextIndex !== currentIndex) {
        setSelectedOption(options[nextIndex]);
      }
    }
  };

  const handleSelect = (option: Option) => {
    setSelectedOption(option);
    setIsOpen(false);
    option.onSelect?.();
    dropdownRef.current?.querySelector("button")?.focus();
  };

  return (
    <div ref={dropdownRef} className="relative" onKeyDown={handleKeyDown}>
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
          className="absolute left-0 w-full mt-1 bg-[#181818] border border-[#101010] rounded shadow-2xl z-50 py-1"
        >
          <div className="px-3 py-1 text-sm font-sans text-[#666666] tracking-wide cursor-default border-b border-border">
            {label}
          </div>

          <div className="flex flex-col gap-px">
            {options.map((option) => {
              const isSelected = option === currentOption;

              return (
                <button
                  key={option.name}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "flex items-center text-left h-7 px-4 text-sm font-sans tracking-wide outline-none transition-colors duration-75 text-[#d0d0d0] hover:bg-[#477cb9] hover:text-white",
                    isSelected && "bg-[#3d6ca4] text-white mx-0.5 rounded w-[calc(100%-4px)]",
                  )}
                >
                  {option.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
