"use client"

import { useRef, useMemo } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { Draggable } from "gsap/Draggable"
import { InertiaPlugin } from "gsap/InertiaPlugin"
import { GithubLogo, ArrowUpRight } from "@phosphor-icons/react"
import { allServiceIcons } from "../dash/icons"

gsap.registerPlugin(Draggable, InertiaPlugin, useGSAP)

export default function Footer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const blobsRef = useRef<HTMLDivElement>(null)

  // Use AWS icons instead of generic blobs. Duplicate them to have enough scattered icons (around 40).
  const icons = useMemo(() => {
    return [...allServiceIcons, ...allServiceIcons].slice(0, 40)
  }, [])

  useGSAP(
    () => {
      // Create draggables with bounds to the container
      Draggable.create(".blob", {
        type: "x,y",
        bounds: containerRef.current,
        inertia: true,
        edgeResistance: 0.8,
        onPress: function () {
          // Bring to front on press
          gsap.set(this.target, { zIndex: 10 })
        },
        onRelease: function () {
          gsap.set(this.target, { zIndex: 1 })
        },
      })

      // Initial random scattering animation
      gsap.fromTo(
        ".blob",
        {
          y: 200,
          opacity: 0,
        },
        {
          y: () => gsap.utils.random(-20, 20),
          x: () => gsap.utils.random(-20, 20),
          opacity: 1,
          stagger: {
            amount: 1,
            from: "random",
          },
          ease: "back.out(1.5)",
          duration: 1,
        },
      )
    },
    { scope: containerRef },
  )

  return (
    <footer
      ref={containerRef}
      className="relative w-full bg-neutral-100 dark:bg-[#111] text-black dark:text-white overflow-hidden pt-20 pb-40 flex flex-col items-center border-t border-neutral-300 dark:border-neutral-800 transition-colors duration-300"
    >
      <div className="w-full max-w-6xl px-6 grid grid-cols-1 md:grid-cols-3 gap-12 z-10 relative">
        {/* Left Column: Logo */}
        <div className="flex flex-col items-start justify-center">
          <div className="relative">
            <div className="text-4xl font-against tracking-wide">Argon</div>
            <div className="absolute -top-4 -right-2 w-12 h-12 bg-emerald-500/20 rounded-full blur-xl -z-10 mix-blend-screen" />
            <div className="absolute top-0 right-4 w-6 h-6 bg-emerald-500/40 rounded-full blur-md -z-10 mix-blend-screen" />
          </div>
        </div>

        {/* Middle Column: Join */}
        <div className="flex flex-col items-start justify-center space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-neutral-400">Try Argon Simulator NOW</div>
            <a href="/graph" className="inline-block px-6 py-2 bg-white text-black rounded text-sm font-medium transition-colors cursor-pointer">Launch App</a>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-neutral-400">Contribute and Star</div>
            <a href="https://github.com/re-juvenate/argon" className="inline-flex items-center space-x-2 px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded text-sm font-medium transition-colors cursor-pointer">
              <GithubLogo weight="fill" className="w-5 h-5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>

        {/* Right Column: Links */}
        <div className="flex flex-col items-start md:items-end justify-center text-sm space-y-4">
          <div className="flex flex-col items-start space-y-3 w-full max-w-[240px]">
            <a href="#" className="flex items-center space-x-1 hover:text-emerald-500 transition-colors w-full group">
              <span>Documentation</span>
              <ArrowUpRight className="w-3 h-3 text-neutral-500 group-hover:text-emerald-500" />
            </a>
            <a href="#" className="flex items-center space-x-1 hover:text-emerald-500 transition-colors w-full group">
              <span>Privacy Policy</span>
              <ArrowUpRight className="w-3 h-3 text-neutral-500 group-hover:text-emerald-500" />
            </a>
            <a href="#" className="flex items-center space-x-1 hover:text-emerald-500 transition-colors w-full group">
              <span>Legal Notice</span>
              <ArrowUpRight className="w-3 h-3 text-neutral-500 group-hover:text-emerald-500" />
            </a>
            <a href="#" className="flex items-center space-x-1 hover:text-emerald-500 transition-colors w-full group">
              <span>Operating Company</span>
              <ArrowUpRight className="w-3 h-3 text-neutral-500 group-hover:text-emerald-500" />
            </a>
          </div>
        </div>
      </div>

      <div className="text-white w-full max-w-6xl px-6 mt-16 flex flex-col md:flex-row justify-between items-start md:items-end text-sm z-10 relative">
        <p className="mt-4 md:mt-0 max-w-md">
          Visualize your cloud architectures with precision.
          <br />
          Built by developers for developers. Free and Open Source.
        </p>
        <p className="order-first md:order-last">© 2026 Argon</p>
      </div>

      <div ref={blobsRef} className="absolute bottom-0 left-0 w-full h-full pointer-events-none z-20">
        <div className="absolute bottom-[-20px] left-0 w-full flex flex-wrap justify-center pointer-events-auto">
          {icons.map((icon, i) => (
            <div
              key={i}
              // The outer div handles GSAP dragging coordinates (No CSS transitions allowed here)
              className="blob relative cursor-grab active:cursor-grabbing w-16 h-16 flex items-center justify-center shrink-0 -ml-4 -mb-4"
            >
              {/* The inner div handles the CSS hover transition safely */}
              <div className="w-full h-full flex items-center justify-center hover:scale-125 transition-transform duration-200">
                <img src={icon.url} alt={icon.name} draggable={false} className="w-10 h-10 object-contain pointer-events-none" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}
