import React, { useEffect, useRef } from "react"
import { ArrowRight, ArrowRightIcon } from "@phosphor-icons/react"

const Fifth = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const arrows = container.querySelectorAll(".tracking-arrow")

    let animationFrameId: number

    const handleMouseMove = (e: MouseEvent) => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)

      animationFrameId = requestAnimationFrame(() => {
        arrows.forEach((arrow) => {
          const rect = arrow.getBoundingClientRect()
          const arrowX = rect.left + rect.width / 2
          const arrowY = rect.top + rect.height / 2

          const angle = Math.atan2(e.clientY - arrowY, e.clientX - arrowX)
          const degree = (angle * 180) / Math.PI

          ;(arrow as HTMLElement).style.transform = `rotate(${degree}deg)`
        })
      })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[80vh] bg-neutral-50 dark:bg-[#0a0a0a] overflow-hidden flex items-center justify-center border-t border-neutral-200 dark:border-neutral-900/50 transition-colors duration-300"
    >
      {/* Arrow Grid Background */}
      <div className="absolute inset-0 grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] content-start gap-4 p-8 pointer-events-none">
        {Array.from({ length: 250 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            <div className="tracking-arrow text-emerald-500 will-change-transform">
              <ArrowRightIcon weight="bold" className="w-10 h-10 md:w-14 md:h-14" />
            </div>
          </div>
        ))}
      </div>

      {/* Center CTA */}
      <div className="relative z-10 pointer-events-auto">
        <button className="group relative px-12 py-6 bg-black dark:bg-white text-white dark:text-black font-black text-5xl md:text-7xl tracking-tighter hover:scale-105 transition-transform duration-300 shadow-[0_0_80px_rgba(16,185,129,0.3)] hover:shadow-[0_0_120px_rgba(16,185,129,0.5)]">
          Deploy the app!
        </button>
      </div>
    </div>
  )
}

export default Fifth
