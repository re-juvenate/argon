"use client"

import React, { useEffect, useRef } from "react"
import gsap from "gsap"
import { CustomEase } from "gsap/CustomEase"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"
import cn from "cnfast"

if (typeof window !== "undefined") {
  gsap.registerPlugin(SplitText, CustomEase, ScrollTrigger)
}

const DEFAULT_TAG = "div"
const DEFAULT_BASE_COLOR = "#ea580c"
const DEFAULT_OVERLAY_COLOR = "var(--background)"
const DEFAULT_STAGGER = 0.2
const DEFAULT_COVER_DURATION = 0.34
const DEFAULT_REVEAL_DURATION = 0.42
const DEFAULT_OVERLAY_ENTER_DURATION = 0.24
const DEFAULT_OVERLAY_EXIT_DURATION = 0.28
const DEFAULT_INSET_X = "0.08em"
const DEFAULT_INSET_Y = "0.08em"
const DEFAULT_TRIGGER_START = "top 85%"
const DEFAULT_DIRECTION = "left"
const DEFAULT_DELAY = 0
const REVEAL_EASE = "obsidianRectangularReveal"
const SCALE_X_ZERO = "scaleX(0)"
const SCALE_Y_ZERO = "scaleY(0)"
const LINE_CLASS_NAME = "tb-line"

type Direction = "left" | "right" | "top" | "bottom"
type Axis = "scaleX" | "scaleY"

function getOrigins(direction: Direction): { enterOrigin: string; exitOrigin: string; axis: Axis } {
  switch (direction) {
    case "right":
      return {
        enterOrigin: "100% 50%",
        exitOrigin: "0% 50%",
        axis: "scaleX",
      }
    case "top":
      return {
        enterOrigin: "50% 0%",
        exitOrigin: "50% 100%",
        axis: "scaleY",
      }
    case "bottom":
      return {
        enterOrigin: "50% 100%",
        exitOrigin: "50% 0%",
        axis: "scaleY",
      }
    case "left":
    default:
      return {
        enterOrigin: "0% 50%",
        exitOrigin: "100% 50%",
        axis: "scaleX",
      }
  }
}

interface CreateRevealRectProps {
  insetX: string
  insetY: string
  background: string
  transformOrigin: string
  axis: Axis
  zIndex: number
  dataAttribute: string
}

function createRevealRect({ insetX, insetY, background, transformOrigin, axis, zIndex, dataAttribute }: CreateRevealRectProps): HTMLDivElement {
  const rect = document.createElement("div")
  rect.setAttribute(dataAttribute, "true")
  Object.assign(rect.style, {
    position: "absolute",
    left: `-${insetX}`,
    right: `-${insetX}`,
    top: `-${insetY}`,
    bottom: `-${insetY}`,
    background,
    transformOrigin,
    transform: axis === "scaleX" ? SCALE_X_ZERO : SCALE_Y_ZERO,
    zIndex: String(zIndex),
    pointerEvents: "none",
    willChange: "transform",
  })

  return rect
}

export interface RectangularTextRevealProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
  baseColor?: string
  overlayColor?: string
  useOverlay?: boolean
  stagger?: number
  coverDuration?: number
  revealDuration?: number
  overlayEnterDuration?: number
  overlayExitDuration?: number
  insetX?: string
  insetY?: string
  triggerStart?: string
  once?: boolean
  direction?: Direction
  delay?: number
  scroller?: HTMLElement | Window | React.RefObject<HTMLElement | null>
  trigger?: HTMLElement | React.RefObject<HTMLElement | null>
}

export function RectangularTextReveal({
  children,
  as: Tag = DEFAULT_TAG,
  className = "",
  baseColor = DEFAULT_BASE_COLOR,
  overlayColor = DEFAULT_OVERLAY_COLOR,
  useOverlay = true,
  stagger = DEFAULT_STAGGER,
  coverDuration = DEFAULT_COVER_DURATION,
  revealDuration = DEFAULT_REVEAL_DURATION,
  overlayEnterDuration = DEFAULT_OVERLAY_ENTER_DURATION,
  overlayExitDuration = DEFAULT_OVERLAY_EXIT_DURATION,
  insetX = DEFAULT_INSET_X,
  insetY = DEFAULT_INSET_Y,
  triggerStart = DEFAULT_TRIGGER_START,
  once = true,
  direction = DEFAULT_DIRECTION,
  delay = DEFAULT_DELAY,
  scroller,
  trigger,
  style,
  ...props
}: RectangularTextRevealProps) {
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!elementRef.current) {
      return
    }

    const media = gsap.matchMedia()
    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const { enterOrigin, exitOrigin, axis } = getOrigins(direction)

        CustomEase.create(REVEAL_EASE, "0.4,0,0.2,1")

        const split = new SplitText(elementRef.current, {
          type: "lines",
          linesClass: LINE_CLASS_NAME,
        })

        const wrappers: HTMLDivElement[] = []
        const baseRects: HTMLDivElement[] = []
        const overlayRects: (HTMLDivElement | null)[] = []

        // Cast the lines array to HTMLElement[] here
        const lines = split.lines as HTMLElement[]

        // Line setup
        gsap.set(elementRef.current, { opacity: 1 })

        lines.forEach((line) => {
          const wrapper = document.createElement("div")
          wrapper.style.position = "relative"
          wrapper.style.display = "block"
          wrapper.style.overflow = "hidden"
          wrapper.style.width = "fit-content"
          wrapper.style.maxWidth = "100%"

          line.parentNode?.insertBefore(wrapper, line)
          wrapper.appendChild(line)

          line.style.position = "relative"
          line.style.display = "block"
          line.style.width = "fit-content"
          line.style.maxWidth = "100%"
          line.style.zIndex = "1"
          line.style.opacity = "0"
          line.style.willChange = "opacity"

          const baseRect = createRevealRect({
            insetX,
            insetY,
            background: baseColor,
            transformOrigin: enterOrigin,
            axis,
            zIndex: 2,
            dataAttribute: "data-reveal-base",
          })
          wrapper.appendChild(baseRect)

          let overlayRect: HTMLDivElement | null = null

          if (useOverlay) {
            overlayRect = createRevealRect({
              insetX,
              insetY,
              background: overlayColor,
              transformOrigin: enterOrigin,
              axis,
              zIndex: 3,
              dataAttribute: "data-reveal-overlay",
            })
            wrapper.appendChild(overlayRect)
          }

          wrappers.push(wrapper)
          baseRects.push(baseRect)
          overlayRects.push(overlayRect)
        })

        // Timeline
        const timeline = gsap.timeline({ paused: true })

        lines.forEach((line, index) => {
          const baseRect = baseRects[index]
          const overlayRect = overlayRects[index]
          const startAt = index * stagger

          if (useOverlay && overlayRect) {
            timeline.to(
              overlayRect,
              {
                [axis]: 1,
                duration: overlayEnterDuration,
                ease: REVEAL_EASE,
                transformOrigin: enterOrigin,
              },
              startAt + 0.1,
            )
          }

          timeline
            .to(
              baseRect,
              {
                [axis]: 1,
                duration: coverDuration,
                ease: REVEAL_EASE,
                transformOrigin: enterOrigin,
              },
              startAt,
            )
            .set(
              line,
              {
                opacity: 1,
              },
              startAt + coverDuration,
            )

          if (useOverlay && overlayRect) {
            timeline.to(
              overlayRect,
              {
                [axis]: 0,
                delay: 0.15,
                duration: overlayExitDuration,
                ease: REVEAL_EASE,
                transformOrigin: exitOrigin,
              },
              startAt + coverDuration + 0.1,
            )
          }

          timeline.to(
            baseRect,
            {
              [axis]: 0,
              delay: useOverlay ? 0.2 : 0.12,
              duration: revealDuration,
              ease: REVEAL_EASE,
              transformOrigin: exitOrigin,
            },
            startAt + coverDuration + 0.1,
          )
        })

        // Scroll trigger
        let delayedPlay: gsap.core.Tween
        const scrollTrigger = ScrollTrigger.create({
          trigger: (trigger as any)?.current !== undefined ? (trigger as any).current : (trigger ?? elementRef.current),
          scroller: (scroller as any)?.current !== undefined ? (scroller as any).current : scroller,
          start: triggerStart,
          once,
          onEnter: () => {
            delayedPlay?.kill()
            delayedPlay = gsap.delayedCall(delay, () => timeline.play())
          },
          ...(once
            ? {}
            : {
                onLeaveBack: () => {
                  delayedPlay?.kill()
                  timeline.pause(0)

                  lines.forEach((line) => {
                    line.style.opacity = "0"
                  })

                  baseRects.forEach((rect) => {
                    gsap.set(rect, {
                      [axis]: 0,
                      transformOrigin: enterOrigin,
                    })
                  })

                  overlayRects.forEach((rect) => {
                    if (!rect) {
                      return
                    }

                    gsap.set(rect, {
                      [axis]: 0,
                      transformOrigin: enterOrigin,
                    })
                  })
                },
              }),
        })

        // Cleanup
        return () => {
          delayedPlay?.kill()
          timeline.kill()
          scrollTrigger.kill()
          split.revert()

          wrappers.forEach((wrapper) => {
            if (!wrapper.parentNode) {
              return
            }

            while (wrapper.firstChild) {
              wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper)
            }

            wrapper.remove()
          })
        }
      },
      elementRef,
    )

    return () => media.revert()
  }, [
    children,
    baseColor,
    coverDuration,
    delay,
    direction,
    insetX,
    insetY,
    once,
    overlayColor,
    overlayEnterDuration,
    overlayExitDuration,
    revealDuration,
    stagger,
    triggerStart,
    useOverlay,
    scroller,
    trigger,
  ])

  return (
    <Tag {...props} ref={elementRef as any} className={cn("font-heading text-foreground", className)} style={style}>
      {children}
    </Tag>
  )
}
