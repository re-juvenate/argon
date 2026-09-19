import { useRef, type RefObject } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { Draggable } from "gsap/Draggable"
import { InertiaPlugin } from "gsap/InertiaPlugin"

gsap.registerPlugin(Draggable, InertiaPlugin)

let front = 1
const bringToFront = (el: HTMLElement) => {
  el.style.zIndex = String(++front)
}

const overlapArea = (a: DOMRect, b: DOMRect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

interface IslandOptions {
  handle?: RefObject<HTMLElement | null>
  flow?: boolean
}

export const useIsland = <T extends HTMLElement = HTMLDivElement>({
  handle,
  flow = false,
}: IslandOptions = {}) => {
  const ref = useRef<T | null>(null)

  useGSAP(
    () => {
      const el = ref.current
      const board = el?.closest<HTMLElement>("[data-island-board]")
      if (!el || !board) return

      if (!flow || el.parentElement === board) {
        el.style.position = "absolute"
      }

      const trigger = handle?.current ?? undefined

      const [instance] = Draggable.create(el, {
        type: "x,y",
        trigger,
        bounds: board,
        inertia: true,
        edgeResistance: 1,
        zIndexBoost: false,
        allowEventDefault: true,
        onPress(this: Draggable) {
          this.applyBounds(board)
        },
        onDragStart(this: Draggable) {
          bringToFront(this.target as HTMLElement)
        },
        onDragEnd(this: Draggable) {
          const parent = el.parentElement
          if (!parent) return

          const r = el.getBoundingClientRect()
          const hit = (
            document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2) as HTMLElement[]
          ).filter((n) => !el.contains(n))
          const ownFrame = el.closest<HTMLElement>("[data-frame]")
          const hitFrame = hit.find((n) => n.dataset.frame !== undefined)
          const otherFrame = hitFrame && hitFrame !== ownFrame ? hitFrame : undefined
          const rawBody = otherFrame?.querySelector<HTMLElement>(":scope > [data-frame-body]")
          const body = rawBody && !rawBody.classList.contains("hidden") ? rawBody : undefined

          const ownRect = ownFrame?.getBoundingClientRect()
          const mostlyOutside = !ownRect || overlapArea(r, ownRect) < (r.width * r.height) / 2
          const commit = (place: () => () => void) => {
            const settle = place()
            gsap.killTweensOf(el, "x,y")
            queueMicrotask(() => gsap.killTweensOf(el, "x,y"))
            requestAnimationFrame(() => {
              gsap.killTweensOf(el, "x,y")
              settle()
            })
          }

          const moveTo = (newParent: HTMLElement) => {
            const prev = el.getBoundingClientRect()
            gsap.set(el, { x: 0, y: 0 })
            el.style.position = "absolute"
            el.style.left = ""
            el.style.top = ""
            bringToFront(el)
            newParent.appendChild(el)
            const now = el.getBoundingClientRect()
            const dx = prev.left - now.left
            const dy = prev.top - now.top
            gsap.set(el, { x: dx, y: dy })
            return () => gsap.set(el, { x: dx, y: dy })
          }

          if (flow) {
            if (parent === board) {
              if (!body) return
              commit(() => {
                el.style.position = ""
                el.style.left = ""
                el.style.top = ""
                gsap.set(el, { x: 0, y: 0 })
                body.appendChild(el)
                return () => gsap.set(el, { x: 0, y: 0 })
              })
            } else if (body) {
              commit(() => {
                if (body !== parent) {
                  el.style.position = ""
                  el.style.left = ""
                  el.style.top = ""
                  gsap.set(el, { x: 0, y: 0 })
                  body.appendChild(el)
                }
                return () => gsap.set(el, { x: 0, y: 0 })
              })
            } else if (mostlyOutside) {
              commit(() => moveTo(board))
            } else {
              commit(() => {
                gsap.set(el, { x: 0, y: 0 })
                return () => gsap.set(el, { x: 0, y: 0 })
              })
            }
          } else {
            if (hitFrame && hitFrame === ownFrame) return
            const target = body ?? board
            if (target === parent) return
            commit(() => moveTo(target))
          }
        },
      })

      return () => {
        instance.kill()
      }
    },
    { scope: ref, dependencies: [handle, flow] },
  )

  return ref
}
