import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import clsx from "clsx"

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
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight
      ) {
        return node
      }
    }
    node = node.parentElement
  }

  return null
}

/**
 * Pannable / zoomable wrapper around the island board.
 * Middle-drag pans, wheel zooms toward the cursor. Everything inside lives in
 * board coordinates; the viewport owns exactly one transform.
 */
export default function Viewport({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>(IDENTITY)
  const [panning, setPanning] = useState(false)

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

  return (
    <div
      ref={ref}
      onPointerDown={startPan}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault()
      }}
      className={clsx(
        "relative w-full h-full overflow-hidden bg-background",
        panning && "cursor-grabbing",
      )}
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
          −
        </button>
        <button
          type="button"
          className={controlButton}
          title="Reset view"
          onClick={() => setTransform(IDENTITY)}
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
          +
        </button>
      </div>
    </div>
  )
}
