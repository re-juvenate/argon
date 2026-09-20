import { allServiceIcons } from "../dash/icons"
import LogoLoop, { type LogoItem } from "./elements/logomarquee"

const Second = ({
  speed = 100,
  direction = "left" as const,
  logoHeight = 60,
  gap = 60,
  scaleOnHover = true,
  fadeOut = true,
  ariaLabel = "AWS Infrastructure Architecture",
}) => {
  const awsLogos: LogoItem[] = allServiceIcons.map((icon) => {
    const cleanTitle = icon.name
      .replace(".svg", "")
      .replace(/([A-Z0-9])/g, " $1")
      .toUpperCase()
      .trim()

    return { src: icon.url, title: cleanTitle, alt: cleanTitle }
  })

  if (awsLogos.length === 0) return null

  return (
    <div className="relative flex h-screen w-full select-none overflow-hidden bg-black pt-4" aria-label={ariaLabel}>
      <LogoLoop
        logos={awsLogos}
        speed={speed}
        direction={direction}
        logoHeight={logoHeight}
        gap={gap}
        scaleOnHover={scaleOnHover}
        fadeOut={fadeOut}
        pauseOnHover={true}
        className="w-full"
      />
    </div>
  )
}

export default Second
