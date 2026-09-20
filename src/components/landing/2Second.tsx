import React from "react"
import { clsx } from "clsx"
import { serviceIcon, type ServiceIcon } from "../dash/icons"

const Second = ({
  speed = 100,
  direction = "left",
  logoHeight = 60,
  gap = 60,
  scaleOnHover = true,
  fadeOut = true,
  ariaLabel = "AWS Infrastructure Architecture",
}) => {
  const iconNames: ServiceIcon[] = ["ec2.svg", "s3.svg", "lambda.svg", "rds.svg"]

  const awsLogos = iconNames
    .map((name) => {
      const src = serviceIcon(name)
      if (!src) return null

      const cleanTitle = name
        .replace(".svg", "")
        .replace(/([A-Z0-9])/g, " \$1")
        .toUpperCase()
        .trim()

      return { src, title: cleanTitle }
    })
    .filter((logo): logo is { src: string; title: string } => logo !== null)

  if (awsLogos.length === 0) return null

  const isReverse = direction === "right"

  return (
    <div className="relative flex h-[200px] w-full items-center overflow-hidden bg-transparent select-none group" aria-label={ariaLabel}>
      {fadeOut && (
        <>
          <div className="absolute top-0 bottom-0 left-0 z-10 w-36 pointer-events-none bg-gradient-to-r from-white to-transparent dark:from-slate-900" />
          <div className="absolute top-0 bottom-0 right-0 z-10 w-36 pointer-events-none bg-gradient-to-l from-white to-transparent dark:from-slate-900" />
        </>
      )}

      <div
        className={clsx(
          "flex w-max animate-[marquee_linear_infinite] group-hover:[animation-play-state:paused]",
          isReverse && "direction-reverse",
          speed && `[animation-duration:${speed}s]`,
        )}
        style={{ gap: `${gap}px` }}
      >
        {[...awsLogos, ...awsLogos].map((logo, index) => (
          <div
            key={`${logo.title}-${index}`}
            className={clsx("flex items-center shrink-0 transition-transform duration-300 ease-in-out", scaleOnHover && "hover:scale-110")}
            style={{ height: `${logoHeight}px` }}
            title={logo.title}
          >
            <img src={logo.src} alt={logo.title} className="h-full w-auto object-contain pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default Second
