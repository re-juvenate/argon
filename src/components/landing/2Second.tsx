import { useMemo } from "react"
import { allServiceIcons } from "../dash/icons"
import Build from "./elements/build"
import LogoLoop, { type LogoItem } from "./elements/logomarquee"

interface SecondProps {
  speed?: number
  direction?: "left" | "right"
  logoHeight?: number
  gap?: number
  scaleOnHover?: boolean
  fadeOut?: boolean
  ariaLabel?: string
}

const Second = ({
  speed = 100,
  direction = "left",
  logoHeight = 40,
  gap = 40,
  scaleOnHover = true,
  fadeOut = true,
  ariaLabel = "AWS Infrastructure Architecture",
}: SecondProps) => {
  const awsLogos = useMemo<LogoItem[]>(() => {
    return allServiceIcons.map((icon) => {
      const cleanTitle = icon.name
        .replace(".svg", "")
        .replace(/([A-Z0-9])/g, " \$1")
        .toUpperCase()
        .trim()

      return {
        src: icon.url,
        title: cleanTitle,
        alt: `${cleanTitle} Service Icon`,
      }
    })
  }, [])

  if (awsLogos.length === 0) return null

  return (
    <section className="relative flex min-h-screen w-screen select-none flex-col overflow-hidden bg-black py-8 md:h-screen" aria-label={ariaLabel}>
      <div className="w-full">
        <LogoLoop
          logos={awsLogos}
          speed={speed}
          direction={direction}
          logoHeight={logoHeight}
          gap={gap}
          scaleOnHover={scaleOnHover}
          fadeOut={fadeOut}
          pauseOnHover
          className="w-full"
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-12 px-6 py-12 md:flex-row md:justify-between md:gap-8 md:px-20 md:py-0">
        <header className="w-full text-center max-w-xl md:text-left">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-4">Review</h2>
          <p className="text-base text-gray-400 sm:text-xl">Check how your application scales, and get a detailed report on your AWS resources.</p>
        </header>

        <div className="w-full max-w-md sm:max-w-xl md:w-1/2 md:max-w-none">
          <Build />
        </div>
      </div>
    </section>
  )
}

export default Second
