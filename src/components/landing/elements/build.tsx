import { useEffect, useRef, useState } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { serviceIcon, type ServiceIcon } from "../../dash/icons"
import bgJust from "../../../assets/images/bg-just.png"

const icons: ServiceIcon[] = ["ec2.svg", "s3.svg", "rds.svg", "lambda.svg", "vpc.svg", "sqs.svg", "apigateway.svg", "dynamodb.svg", "cloudfront.svg"]

const VIEWBOX = "0 0 709 538"

const EXTRUSION_PATH = `
  M 52 258
  L 319 412
  C 331 419 342 424 352 426
  C 362 427 371 423 381 418
  L 641 259
  L 641 301
  C 641 314 635 322 624 328
  L 374 464
  C 357 474 342 474 325 465
  L 63 314
  C 55 309 52 301 52 291
  Z
`

const TOP_PATH = `
  M 52 258
  C 52 246 57 236 68 229
  L 320 84
  C 338 74 349 71 360 76
  L 634 232
  C 642 237 646 246 646 257
  L 646 274
  C 646 286 640 296 629 302
  L 380 423
  C 363 432 348 434 330 425
  L 65 272
  C 56 267 52 263 52 258
  Z
`

const COLS = 3
const LIFT_Y = -40
const LIFT_DURATION = 1

export default function Build() {
  const [lifted, setLifted] = useState<Set<number>>(new Set())

  const root = useRef<HTMLDivElement>(null)
  const tiles = useRef<(HTMLDivElement | null)[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useGSAP(
    () => {
      tiles.current.forEach((tile) => {
        if (tile) gsap.set(tile, { y: 0 })
      })
    },
    { scope: root },
  )

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const liftTile = (index: number) => {
    const tile = tiles.current[index]

    if (!tile) return

    clearTimeout(timers.current[index])

    setLifted((prev) => {
      const next = new Set(prev)
      next.add(index)
      return next
    })

    gsap.killTweensOf(tile)

    gsap
      .timeline()
      .to(tile, {
        y: LIFT_Y - 6,
        duration: 0.25,
        ease: "power2.out",
      })
      .to(tile, {
        y: LIFT_Y,
        duration: 0.35,
        ease: "bounce.out",
      })

    timers.current[index] = setTimeout(() => {
      setLifted((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })

      gsap.to(tile, {
        y: 0,
        duration: 0.35,
        ease: "power2.inOut",
      })
    }, LIFT_DURATION * 1000)
  }

  return (
    <div ref={root} className="relative mx-auto aspect-[16/10] w-full max-w-4xl overflow-visible">
      {icons.map((icon, index) => {
        const image = serviceIcon(icon)
        if (!image) return null

        const row = Math.floor(index / COLS)
        const col = index % COLS

        const left = col * 24.5 + row * -24.5 + 35
        const top = row * 18.5 + col * 18.5 + 5
        const baseZIndex = (row + col) * 10
        const isLifted = lifted.has(index)
        const maskId = `extrusion-mask-${index}`

        return (
          <div
            key={icon}
            ref={(element) => {
              tiles.current[index] = element
            }}
            onMouseEnter={() => liftTile(index)}
            className="absolute aspect-[709/538] w-[38%] will-change-transform"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              zIndex: isLifted ? baseZIndex + 50 : baseZIndex,
            }}
          >
            <svg viewBox={VIEWBOX} className="absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <clipPath id={maskId}>
                  <path d={EXTRUSION_PATH} />
                </clipPath>
              </defs>

              <path d={EXTRUSION_PATH} fill="#16161a" />

              <g className={["transition-opacity duration-300 ease-out", isLifted ? "opacity-100" : "opacity-0"].join(" ")}>
                <image href={bgJust} x="0" y="0" width="709" height="538" preserveAspectRatio="none" clipPath={`url(#${maskId})`} />
              </g>

              <path d={TOP_PATH} fill="#1b1b22" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />

              <image href={image} x="0" y="0" width="275" height="275" preserveAspectRatio="none" transform="matrix(0.86 -0.5 0.86 0.5 120 250)" />
            </svg>
          </div>
        )
      })}
    </div>
  )
}
