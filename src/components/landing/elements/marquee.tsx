"use client"

import React, { useCallback, useEffect, useId, useRef } from "react"
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  useReducedMotion,
  MotionValue,
} from "motion/react"

// Custom wrap function
const wrap = (min: number, max: number, value: number): number => {
  const range = max - min
  return ((((value - min) % range) + range) % range) + min
}

interface MarqueePathItemProps {
  child: React.ReactNode
  repeatIndex: number
  itemIndex: number
  itemKey: string
  baseOffset: MotionValue<number>
  itemCount: number
  easing?: (value: number) => number
  calculateZIndex: (offsetDistance: number) => number | undefined
  cssVariableInterpolation: Array<{ property: string; from: number; to: number }>
  draggable: boolean
  grabCursor: boolean
  path: string
  enableRollingZIndex: boolean
  itemRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  isHoveredRef: React.MutableRefObject<boolean>
}

function MarqueePathItem({
  child,
  repeatIndex,
  itemIndex,
  itemKey,
  baseOffset,
  itemCount,
  easing,
  calculateZIndex,
  cssVariableInterpolation,
  draggable,
  grabCursor,
  path,
  enableRollingZIndex,
  itemRefs,
  isHoveredRef,
}: MarqueePathItemProps) {
  const itemOffset = useTransform(baseOffset, (value: number) => {
    const position = (itemIndex * 100) / itemCount
    const wrappedValue = wrap(0, 100, value + position)
    return `${easing ? easing(wrappedValue / 100) * 100 : wrappedValue}%`
  })

  const currentOffsetDistance = useMotionValue(0)
  const zIndex = useTransform(currentOffsetDistance, (value: number) => calculateZIndex(value))
  const itemRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const unsubscribe = itemOffset.on("change", (value: string) => {
      const match = value.match(/^([\d.]+)%$/)
      if (match && match[1]) {
        const numericValue = parseFloat(match[1])
        currentOffsetDistance.set(numericValue)

        if (itemRef.current) {
          cssVariableInterpolation.forEach(({ property, from, to }) => {
            const nextValue = from + (to - from) * (numericValue / 100)
            itemRef.current!.style.setProperty(property, String(nextValue))
          })
        }
      }
    })
    return unsubscribe
  }, [cssVariableInterpolation, currentOffsetDistance, itemOffset])

  return (
    <motion.div
      key={itemKey}
      ref={(el: HTMLDivElement | null) => {
        itemRef.current = el
        if (el) itemRefs.current.set(itemKey, el)
        else itemRefs.current.delete(itemKey)
      }}
      className={`absolute top-0 left-0 ${draggable && grabCursor ? "cursor-grab" : ""}`}
      style={
        {
          offsetPath: `path('${path}')`,
          offsetDistance: itemOffset,
          zIndex: enableRollingZIndex ? zIndex : undefined,
          willChange: "offset-distance",
          backfaceVisibility: "hidden",
        } as any
      }
      aria-hidden={repeatIndex > 0}
      onMouseEnter={() => (isHoveredRef.current = true)}
      onMouseLeave={() => (isHoveredRef.current = false)}
    >
      {child}
    </motion.div>
  )
}

export interface SvgPathMarqueeProps {
  children?: React.ReactNode
  className?: string
  path: string
  pathId?: string
  preserveAspectRatio?: string
  showPath?: boolean
  width?: string | number
  height?: string | number
  viewBox?: string
  baseVelocity?: number
  direction?: string
  easing?: (value: number) => number
  slowdownOnHover?: boolean
  slowDownFactor?: number
  slowDownSpringConfig?: { damping: number; stiffness: number }
  useScrollVelocity?: boolean
  scrollAwareDirection?: boolean
  scrollSpringConfig?: { damping: number; stiffness: number }
  scrollContainer?: React.RefObject<HTMLElement | null>
  repeat?: number
  draggable?: boolean
  dragSensitivity?: number
  dragVelocityDecay?: number
  dragAwareDirection?: boolean
  grabCursor?: boolean
  enableRollingZIndex?: boolean
  zIndexBase?: number
  zIndexRange?: number
  cssVariableInterpolation?: Array<{ property: string; from: number; to: number }>
  responsive?: boolean
  label?: string
}

export const SvgPathMarquee = ({
  children,
  className,

  // Path defaults
  path,

  pathId,
  preserveAspectRatio = "xMidYMid meet",
  showPath = false,

  // SVG defaults
  width = "100%",

  height = "100%",
  viewBox = "0 0 100 100",

  // Marquee defaults
  baseVelocity = 5,

  direction = "normal",
  easing,
  slowdownOnHover = false,
  slowDownFactor = 0.3,
  slowDownSpringConfig = { damping: 50, stiffness: 400 },

  // Scroll defaults
  useScrollVelocity = false,

  scrollAwareDirection = false,
  scrollSpringConfig = { damping: 50, stiffness: 400 },
  scrollContainer,

  // Items repetition
  repeat = 3,

  // Drag defaults
  draggable = false,

  dragSensitivity = 0.2,
  dragVelocityDecay = 0.96,
  dragAwareDirection = false,
  grabCursor = false,

  // Z-index defaults
  enableRollingZIndex = true,

  // Base z-index value
  zIndexBase = 1,

  // Range of z-index values to use
  zIndexRange = 10,

  cssVariableInterpolation = [],

  // Responsive defaults
  responsive = false,
  label = "Images following a curved path. Drag or use the left and right arrow keys.",
}: SvgPathMarqueeProps) => {
  const container = useRef<HTMLDivElement>(null)
  const marqueeContainerRef = useRef<HTMLDivElement>(null)
  const baseOffset = useMotionValue(0)

  const pathRef = useRef<SVGPathElement>(null)

  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const generatedPathId = useId()
  const reduceMotion = useReducedMotion()

  // Responsive scaling using direct DOM manipulation (no re-renders)
  useEffect(() => {
    if (!responsive) return

    const [, , vbWidth, vbHeight] = viewBox.split(" ").map(Number)
    const originalWidth = vbWidth || 100
    const originalHeight = vbHeight || 100

    const updateScale = () => {
      const wrapper = container.current
      const marqueeContainer = marqueeContainerRef.current
      if (!wrapper || !marqueeContainer) return

      const wrapperWidth = wrapper.clientWidth
      const wrapperHeight = wrapper.clientHeight

      const scaleX = wrapperWidth / originalWidth
      const scaleY = wrapperHeight / originalHeight
      const scale = Math.min(scaleX, scaleY)

      // Calculate the scaled dimensions
      const scaledWidth = originalWidth * scale
      const scaledHeight = originalHeight * scale

      // Center the marquee container within the wrapper
      const offsetX = (wrapperWidth - scaledWidth) / 2
      const offsetY = (wrapperHeight - scaledHeight) / 2

      // Set fixed dimensions on the container
      marqueeContainer.style.width = `${originalWidth}px`
      marqueeContainer.style.height = `${originalHeight}px`

      // Apply scale and position to center
      marqueeContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`
      marqueeContainer.style.transformOrigin = "top left"
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    if (container.current) observer.observe(container.current)
    window.addEventListener("resize", updateScale)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateScale)
    }
  }, [responsive, viewBox])

  // Create an array of items outside of the render function
  const items = React.useMemo(() => {
    const childrenArray = React.Children.toArray(children)

    return childrenArray.flatMap((child, childIndex) =>
      Array.from({ length: repeat }, (_, repeatIndex) => {
        const itemIndex = repeatIndex * childrenArray.length + childIndex
        const key = `${childIndex}-${repeatIndex}`
        return {
          child,
          childIndex,
          repeatIndex,
          itemIndex,
          key,
        }
      }),
    )
  }, [children, repeat])

  // Function to calculate z-index based on offset distance
  const calculateZIndex = useCallback(
    (offsetDistance: number): number | undefined => {
      if (!enableRollingZIndex) {
        return undefined
      }

      // Simple progress-based z-index
      const normalizedDistance = offsetDistance / 100
      return Math.floor(zIndexBase + normalizedDistance * zIndexRange)
    },
    [enableRollingZIndex, zIndexBase, zIndexRange],
  )

  // Generate a random ID for the path if not provided
  const id = pathId || `marquee-path-${generatedPathId.replace(/:/g, "")}`

  // Scroll tracking
  const { scrollY } = useScroll({
    container: scrollContainer || undefined,
  })

  const scrollVelocity = useVelocity(scrollY)
  const smoothVelocity = useSpring(scrollVelocity, scrollSpringConfig)

  // Hover and drag state tracking
  const isHoveredRef = useRef(false)
  const isDragging = useRef(false)
  const dragVelocity = useRef(0)

  // Direction factor for changing direction based on scroll or drag
  const directionFactor = useRef(direction === "normal" ? 1 : -1)

  // Motion values for animation
  const hoverFactorValue = useMotionValue(1)
  const defaultVelocity = useMotionValue(1)
  const smoothHoverFactor = useSpring(hoverFactorValue, slowDownSpringConfig)

  // Transform scroll velocity into a factor that affects marquee speed
  const velocityFactor = useTransform(useScrollVelocity ? smoothVelocity : defaultVelocity, [0, 1000], [0, 5], { clamp: false })

  // Animation frame handler
  useAnimationFrame((_, delta) => {
    if (reduceMotion) return
    if (isDragging.current && draggable) {
      baseOffset.set(baseOffset.get() + dragVelocity.current)

      // Add decay to dragVelocity
      dragVelocity.current *= 0.9

      // Stop completely if velocity is very small
      if (Math.abs(dragVelocity.current) < 0.01) {
        dragVelocity.current = 0
      }

      return
    }

    // Update hover factor
    if (isHoveredRef.current) {
      hoverFactorValue.set(slowdownOnHover ? slowDownFactor : 1)
    } else {
      hoverFactorValue.set(1)
    }

    // Calculate regular movement
    let moveBy = directionFactor.current * baseVelocity * (delta / 1000) * smoothHoverFactor.get()

    // Adjust movement based on scroll velocity if scrollAwareDirection is enabled
    if (scrollAwareDirection && !isDragging.current) {
      if (velocityFactor.get() < 0) {
        directionFactor.current = -1
      } else if (velocityFactor.get() > 0) {
        directionFactor.current = 1
      }
    }

    moveBy += directionFactor.current * moveBy * velocityFactor.get()

    if (draggable) {
      moveBy += dragVelocity.current

      // Update direction based on drag direction if dragAwareDirection is true
      if (dragAwareDirection && Math.abs(dragVelocity.current) > 0.1) {
        directionFactor.current = Math.sign(dragVelocity.current)
      }

      // Gradually decay drag velocity back to zero
      if (!isDragging.current && Math.abs(dragVelocity.current) > 0.01) {
        dragVelocity.current *= dragVelocityDecay
      } else if (!isDragging.current) {
        dragVelocity.current = 0
      }
    }

    baseOffset.set(baseOffset.get() + moveBy)
  })

  // Pointer event handlers for dragging
  const lastPointerPosition = useRef({ x: 0, y: 0 })

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) return
    e.currentTarget.setPointerCapture(e.pointerId)

    if (grabCursor) {
      e.currentTarget.style.cursor = "grabbing"
    }

    isDragging.current = true
    lastPointerPosition.current = { x: e.clientX, y: e.clientY }

    // Pause automatic animation by setting velocity to 0
    dragVelocity.current = 0
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable || !isDragging.current) return

    const currentPosition = { x: e.clientX, y: e.clientY }

    // Calculate movement delta - simplified for path movement
    const deltaX = currentPosition.x - lastPointerPosition.current.x
    const deltaY = currentPosition.y - lastPointerPosition.current.y

    // For path following, we use a simple magnitude of movement
    const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const projectedDelta = deltaX > 0 ? delta : -delta

    // Update drag velocity based on the projected movement
    dragVelocity.current = projectedDelta * dragSensitivity
    if (reduceMotion) baseOffset.set(baseOffset.get() + dragVelocity.current)

    // Update last position
    lastPointerPosition.current = currentPosition
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    isDragging.current = false

    if (grabCursor) {
      e.currentTarget.style.cursor = "grab"
    }
  }

  return (
    <div
      ref={container}
      role="region"
      tabIndex={draggable ? 0 : undefined}
      aria-label={label}
      onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!draggable || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return
        event.preventDefault()
        baseOffset.set(baseOffset.get() + (event.key === "ArrowRight" ? 5 : -5))
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative font-body outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring ${className || ""}`}
    >
      <div ref={marqueeContainerRef} className="relative" style={{ contain: "layout style" }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={width}
          height={height}
          viewBox={viewBox}
          preserveAspectRatio={preserveAspectRatio}
          className="w-full h-full"
        >
          <path id={id} d={path} stroke={showPath ? "currentColor" : "none"} fill="none" ref={pathRef} />
        </svg>

        {items.map(({ child, repeatIndex, itemIndex, key }) => (
          <MarqueePathItem
            key={key}
            child={child}
            repeatIndex={repeatIndex}
            itemIndex={itemIndex}
            itemKey={key}
            baseOffset={baseOffset}
            itemCount={items.length}
            easing={easing}
            calculateZIndex={calculateZIndex}
            cssVariableInterpolation={cssVariableInterpolation}
            draggable={draggable}
            grabCursor={grabCursor}
            path={path}
            enableRollingZIndex={enableRollingZIndex}
            itemRefs={itemRefs}
            isHoveredRef={isHoveredRef}
          />
        ))}
      </div>
    </div>
  )
}

export { SvgPathMarquee as MarqueeAlongSvgPath }
