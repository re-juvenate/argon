import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import clsx from "clsx"
import { MinusIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr"

const MIN_SCALE = 0.4
const MAX_SCALE = 2.5
/** Wheel pixels → zoom factor; exponential so trackpad and mouse wheels feel alike. */
const WHEEL_ZOOM_RATE = 0.0015

/**
 * The board is a finite (but huge) rectangle centered on the transform origin,
 * so there is always droppable surface under the cursor no matter where you
 * pan. The identity transform centers the board's origin on screen.
 */
export const BOARD_HALF = 50_000

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

interface Transform {
  x: number
  y: number
  scale: number
}

const IDENTITY: Transform = { x: BOARD_HALF, y: BOARD_HALF, scale: 1 }

const zoomAt = (prev: Transform, cursorX: number, cursorY: number, deltaY: number): Transform => {
  const scale = clamp(prev.scale * Math.exp(-deltaY * WHEEL_ZOOM_RATE), MIN_SCALE, MAX_SCALE)
  const applied = scale / prev.scale
  // Keep the point under the cursor stationary while the scale changes.
  return {
    scale,
    x: cursorX - (cursorX - prev.x) * applied,
    y: cursorY - (cursorY - prev.y) * applied,
  }
}

/** Pinch zoom: scale by the finger-distance ratio, keeping the midpoint
    stationary in board coordinates (same invariant as zoomAt). */
const pinchAt = (
  prev: Transform,
  prevDist: number,
  prevMid: { x: number; y: number },
  dist: number,
  mid: { x: number; y: number },
): Transform => {
  const scale = clamp(prev.scale * (dist / Math.max(prevDist, 1)), MIN_SCALE, MAX_SCALE)
  const bx = (prevMid.x - prev.x) / prev.scale
  const by = (prevMid.y - prev.y) / prev.scale
  return { scale, x: mid.x - bx * scale, y: mid.y - by * scale }
}

const controlButton =
  "size-8 grid place-items-center rounded bg-neutral-800/90 text-white text-sm font-mono select-none hover:bg-neutral-700 active:scale-95 transition border border-neutral-700"

/**
 * Nearest ancestor of `target` (up to `boundary`) with a live vertical scrollbar,
 * or null. Used to let the browser scroll instead of zooming underneath it.
 */
const findScrollable = (target: EventTarget | null, boundary: HTMLElement): HTMLElement | null => {
  let node = target instanceof Element ? target : null

  while (node && node !== boundary) {
    if (node instanceof HTMLElement) {
      const { overflowY } = getComputedStyle(node)
      if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
        return node
      }
    }
    node = node.parentElement
  }

  return null
}

/**
 * Pannable / zoomable wrapper around the island board.
 * Middle-drag or one finger pans, wheel / pinch zooms toward the cursor.
 * Everything inside lives in board coordinates; the viewport owns exactly one
 * transform. Touches on islands never reach here (nodes stop propagation),
 * so gestures only own the empty canvas.
 */
export default function Viewport({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>(IDENTITY)
  const [panning, setPanning] = useState(false)
  const touchPointers = useRef(new Map<number, { x: number; y: number }>())

  type Gesture = { mode: "pan"; lastX: number; lastY: number } | { mode: "pinch"; dist: number; mid: { x: number; y: number } }
  const gesture = useRef<Gesture | null>(null)

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setTransform({ x: rect.width / 2, y: rect.height / 2, scale: 1 })
    }
  }, [])

  // Native listener: React's onWheel is passive, and zoom must preventDefault.
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      // Over a scrollable list (e.g. an open dropdown): scroll it, don't zoom.
      if (findScrollable(e.target, el)) return

      e.preventDefault()
      const rect = el.getBoundingClientRect()
      setTransform((prev) => zoomAt(prev, e.clientX - rect.left, e.clientY - rect.top, e.deltaY))
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      el.removeEventListener("wheel", onWheel)
    }
  }, [])

  const startPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 1) return
    // Suppress the browser's middle-click autoscroll.
    e.preventDefault()
    const el = ref.current
    if (!el) return

    setPanning(true)
    el.setPointerCapture(e.pointerId)

    const start = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }

    const onMove = (ev: PointerEvent) => {
      setTransform((prev) => ({
        ...prev,
        x: start.tx + (ev.clientX - start.x),
        y: start.ty + (ev.clientY - start.y),
      }))
    }
    const onUp = () => {
      setPanning(false)
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
    }
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
  }

  // Touch: one finger pans, two fingers pinch-zoom. Window-level listeners so
  // the gesture survives the finger leaving the element.
  const onTouchDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    touchPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const el = ref.current
    if (!el) return

    const points = [...touchPointers.current.values()]
    gesture.current =
      points.length >= 2
        ? {
            mode: "pinch",
            dist: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
            mid: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
          }
        : { mode: "pan", lastX: e.clientX, lastY: e.clientY }

    const onMove = (ev: PointerEvent) => {
      if (!touchPointers.current.has(ev.pointerId)) return
      touchPointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      const g = gesture.current
      if (!g) return
      if (g.mode === "pan") {
        const dx = ev.clientX - g.lastX
        const dy = ev.clientY - g.lastY
        g.lastX = ev.clientX
        g.lastY = ev.clientY
        setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
      } else {
        const pts = [...touchPointers.current.values()]
        if (pts.length < 2) return
        const rect = el.getBoundingClientRect()
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        const mid = { x: (pts[0].x + pts[1].x) / 2 - rect.left, y: (pts[0].y + pts[1].y) / 2 - rect.top }
        const prevMid = { x: g.mid.x - rect.left, y: g.mid.y - rect.top }
        setTransform((prev) => pinchAt(prev, g.dist, prevMid, dist, mid))
        g.dist = dist
        g.mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      }
    }
    const onUp = (ev: PointerEvent) => {
      touchPointers.current.delete(ev.pointerId)
      const remaining = [...touchPointers.current.values()]
      if (remaining.length === 0) {
        gesture.current = null
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onUp)
      } else if (remaining.length === 1 && gesture.current?.mode === "pinch") {
        gesture.current = { mode: "pan", lastX: remaining[0].x, lastY: remaining[0].y }
      }
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") onTouchDown(e)
        startPan(e)
      }}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault()
      }}
      className={clsx("relative w-full h-full overflow-hidden bg-background touch-none", panning && "cursor-grabbing")}
    >
      {/* The board rectangle itself: huge and centered on the transform
          origin, so panning never runs the drop surface out from under the
          cursor. Content renders at the transform origin (the visible top-left
          at identity), well inside the board. */}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${transform.x - BOARD_HALF * transform.scale}px, ${
            transform.y - BOARD_HALF * transform.scale
          }px) scale(${transform.scale})`,
          width: BOARD_HALF * 2,
          height: BOARD_HALF * 2,
        }}
      >
        <div className="relative w-full h-full">{children}</div>
      </div>

      <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1.5 z-10">
        <button
          type="button"
          className={controlButton}
          title="Zoom out"
          onClick={() =>
            setTransform((prev) => {
              const rect = ref.current!.getBoundingClientRect()
              return zoomAt(prev, rect.width / 2, rect.height / 2, -120)
            })
          }
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          className="h-8 min-w-8 px-2 grid place-items-center rounded bg-neutral-800/90 text-white text-sm font-mono select-none hover:bg-neutral-700 active:scale-95 transition border border-neutral-700"
          title="Reset view"
          onClick={() => {
            if (ref.current) {
              const rect = ref.current.getBoundingClientRect()
              setTransform({ x: rect.width / 2, y: rect.height / 2, scale: 1 })
            }
          }}
        >
          {Math.round(transform.scale * 100)}%
        </button>
        <button
          type="button"
          className={controlButton}
          title="Zoom in"
          onClick={() =>
            setTransform((prev) => {
              const rect = ref.current!.getBoundingClientRect()
              return zoomAt(prev, rect.width / 2, rect.height / 2, 120)
            })
          }
        >
          <MinusIcon />
        </button>
      </div>
    </div>
  )
}
