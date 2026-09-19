import { useRef, type RefObject } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { Draggable } from "gsap/Draggable"
import { InertiaPlugin } from "gsap/InertiaPlugin"
import { useEditor } from "./EditorContext"

gsap.registerPlugin(Draggable, InertiaPlugin)

let front = 1

const NODE_LAYER = 1000

const bringToFront = (el: HTMLElement, layer: number) => {
  el.style.zIndex = String(layer + ++front)
}

const overlapArea = (a: DOMRect, b: DOMRect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

interface IslandOptions {
  handle?: RefObject<HTMLElement | null>
  flow?: boolean
  enabled?: boolean
}

export const useIsland = <T extends HTMLElement = HTMLDivElement>({
  handle,
  flow = false,
  enabled = true,
}: IslandOptions = {}) => {
  const ref = useRef<T | null>(null)
  const { moveNode } = useEditor()

  useGSAP(
    () => {
      const el = ref.current
      if (!el || !enabled) return

      const board = el.closest<HTMLElement>("[data-island-board]")

      if (!board) return

      const host = el.parentElement?.closest<HTMLElement>(":not(.contents)")

      if (!flow || host === board) {
        el.style.position = "absolute"
      }

      const trigger = handle?.current ?? undefined

      let finished = true

      const getNodeId = () => el.closest<HTMLElement>("[data-island-id]")?.dataset.islandId ?? null

      const getFrameAtPoint = (x: number, y: number) => {
        const elements = document.elementsFromPoint(x, y) as HTMLElement[]

        for (const element of elements) {
          const frame = element.closest<HTMLElement>("[data-frame]")

          if (!frame || el.contains(frame)) continue

          const body = frame.querySelector<HTMLElement>(":scope > [data-frame-body]")

          if (body && !body.classList.contains("hidden")) {
            return {
              frame,
              body,
            }
          }
        }

        return null
      }

      const container = () => el.parentElement?.closest<HTMLElement>("[data-frame]")

      const settleDrop = () => {
        if (finished) return
        finished = true
        container()?.removeAttribute("data-dragging")

        const nodeId = getNodeId()
        if (!nodeId) return

        const rect = el.getBoundingClientRect()
        const boardRect = board.getBoundingClientRect()

        // The board lives inside a pannable/zoomable viewport: rect deltas are
        // screen pixels, but x/y are board-local. Divide by the board's scale.
        const scale = board.offsetWidth > 0 ? boardRect.width / board.offsetWidth : 1
        const css = getComputedStyle(el)
        const marginX = parseFloat(css.marginLeft) || 0
        const marginY = parseFloat(css.marginTop) || 0

        const ownFrame = el.closest<HTMLElement>("[data-frame]")

        const ownFrameId = ownFrame?.dataset.frame ?? null

        const hit = getFrameAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)

        let parentId: string | null = null
        let x = 0
        let y = 0

        if (flow) {
          if (hit) {
            parentId = hit.frame.dataset.frame ?? null
          } else if (ownFrame) {
            const ownRect = ownFrame.getBoundingClientRect()

            const mostlyOutside = overlapArea(rect, ownRect) < (rect.width * rect.height) / 2

            parentId = mostlyOutside ? null : ownFrameId
          }

          if (parentId === null) {
            x = (rect.left - boardRect.left) / scale - marginX
            y = (rect.top - boardRect.top) / scale - marginY
          }
        } else {
          parentId = hit?.frame.dataset.frame ?? null

          if (parentId === null || !hit) {
            x = (rect.left - boardRect.left) / scale - marginX
            y = (rect.top - boardRect.top) / scale - marginY
          } else {
            const bodyRect = hit.body.getBoundingClientRect()

            x = (rect.left - bodyRect.left) / scale - marginX
            y = (rect.top - bodyRect.top) / scale - marginY
          }
        }

        gsap.killTweensOf(el, "x,y")
        gsap.set(el, {
          x: 0,
          y: 0,
        })

        moveNode(nodeId, parentId, x, y)
      }

      const [instance] = Draggable.create(el, {
        type: "x,y",
        trigger,
        inertia: true,
        zIndexBoost: false,
        allowEventDefault: true,

        onPress(this: Draggable) {
          finished = false
          container()?.setAttribute("data-dragging", "")
        },

        onDragStart(this: Draggable) {
          bringToFront(this.target as HTMLElement, flow ? NODE_LAYER : 0)
        },

        onDragEnd(this: Draggable) {
          queueMicrotask(() => {
            if (!this.isThrowing) {
              settleDrop()
            }
          })
        },

        onThrowComplete(this: Draggable) {
          settleDrop()
        },
      })

      return () => {
        instance.kill()
        gsap.killTweensOf(el)
      }
    },
    {
      scope: ref,
      dependencies: [handle, flow, enabled, moveNode],
    },
  )

  return ref
}
