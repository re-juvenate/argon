"use client"

import React, { useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import cn from "cnfast"
import "./hover-img.css"

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP)
}

interface ProjectItem {
  title: string
  label: string
  imageSrc: string
}

const defaultProjects: ProjectItem[] = [
  {
    title: "Shree Krishna",
    label: "The Supreme Personality of Godhead",
    imageSrc: "/cdn/hover-img/hover-img-img01-alt.jpg?v=3",
  },
  {
    title: "Radha Krishna",
    label: "The Divine Couple",
    imageSrc: "/cdn/hover-img/hover-img-img02.jpg?v=3",
  },
  {
    title: "Divine Love",
    label: "Eternal Bond",
    imageSrc: "/cdn/hover-img/hover-img-img03.jpg?v=3",
  },
]

interface HoverImgProps {
  projects?: ProjectItem[]
  className?: string
  isContained?: boolean // New prop for grid previews
  compact?: boolean // New prop for compact layout
}

export function HoverImg({ projects = defaultProjects, className, isContained = false, compact = false }: HoverImgProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const thumbnailRef = useRef<HTMLDivElement>(null)
  const xToRef = useRef<gsap.QuickToFunc | null>(null)
  const yToRef = useRef<gsap.QuickToFunc | null>(null)

  useGSAP(
    () => {
      const projectThumbnail = thumbnailRef.current
      const projectsContainer = containerRef.current?.querySelector(".hover-img-projects") as HTMLElement | null

      if (!projectThumbnail || !projectsContainer) return

      const projectElements = gsap.utils.toArray(".hover-img-project") as HTMLElement[]
      const thumbnails = gsap.utils.toArray(".hover-img-thumbnail", projectThumbnail) as HTMLElement[]

      gsap.set(projectThumbnail, { scale: 0, xPercent: -50, yPercent: -50 })

      xToRef.current = gsap.quickTo(projectThumbnail, "x", {
        duration: 0.4,
        ease: "power3.out",
      })
      yToRef.current = gsap.quickTo(projectThumbnail, "y", {
        duration: 0.4,
        ease: "power3.out",
      })

      const handleMouseMove = (e: MouseEvent) => {
        let x = e.clientX
        let y = e.clientY

        if (isContained && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          x = e.clientX - rect.left
          y = e.clientY - rect.top
        }

        xToRef.current?.(x)
        yToRef.current?.(y)
      }

      const handleMouseLeave = () => {
        gsap.to(projectThumbnail, {
          scale: 0,
          duration: 0.3,
          ease: "power2.out",
          overwrite: "auto",
        })
      }

      projectsContainer.addEventListener("mousemove", handleMouseMove)
      projectsContainer.addEventListener("mouseleave", handleMouseLeave)

      const projectListeners: Array<() => void> = []

      projectElements.forEach((project, index) => {
        const handleMouseEnter = () => {
          gsap.to(projectThumbnail, {
            scale: 1,
            duration: 0.4,
            ease: "power2.out",
            overwrite: "auto",
          })

          gsap.to(thumbnails, {
            yPercent: -100 * index,
            duration: 0.4,
            ease: "power2.out",
            overwrite: "auto",
          })
        }

        project.addEventListener("mouseenter", handleMouseEnter)
        projectListeners.push(() => project.removeEventListener("mouseenter", handleMouseEnter))
      })

      return () => {
        projectsContainer.removeEventListener("mousemove", handleMouseMove)
        projectsContainer.removeEventListener("mouseleave", handleMouseLeave)
        projectListeners.forEach((cleanup) => cleanup())
      }
    },
    { scope: containerRef, dependencies: [projects, isContained] },
  )

  return (
    <>
      <div className="w-screen">
        <h2 className="bg-[#f2f2f2] text-5xl font-against text-black dark:text-white transition-colors duration-300">Features</h2>
        <p className="bg-[#f2f2f2] text-neutral-500 dark:text-neutral-400 mt-4 text-lg max-w-2xl mx-auto transition-colors duration-300 w-full">
          Everything you need to design, simulate, and deploy robust AWS cloud architectures.
        </p>
      </div>
      <div className={cn("hover-img-container", compact && "hover-img-compact", className)} ref={containerRef}>
        <div className="hover-img-projects">
          {projects.map((project, index) => (
            <div className="hover-img-project" key={index}>
              <h2>{project.title}</h2>
              <p>{project.label}</p>
            </div>
          ))}
        </div>

        <div className="hover-img-thumbnail-wrapper" ref={thumbnailRef} style={isContained ? { position: "absolute" } : undefined}>
          {projects.map((project, index) => (
            <div className="hover-img-thumbnail" key={index}>
              <img src={project.imageSrc} alt={project.title} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default HoverImg
