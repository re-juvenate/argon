import React from "react"
import { cn } from "cnfast"

const Button = ({ label, onClick }: { label: string; onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center w-full h-7 px-3 border rounded tracking-wide font-sans text-sm transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-[#477cb9]",
        "bg-[#2e2e2e] border-[#151515] hover:bg-[#353535] text-[#e0e0e0]"
      )}
    >
      {label}
    </button>
  )
}

export default Button
