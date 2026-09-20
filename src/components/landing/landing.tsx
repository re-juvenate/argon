import { useMemo } from "react"
import First from "./1first"
import Second from "./2Second"
import Third from "./3Third"
import Fourth from "./4Fourth"
import Fifth from "./5Fifth"
import NavBar from "./NavBar"
import Footer from "./footer"
import LogoLoop, { type LogoItem } from "./elements/logomarquee"
import { allServiceIcons } from "../dash/icons"

const Landing = () => {
  const awsLogos = useMemo<LogoItem[]>(() => {
    return allServiceIcons.map((icon) => {
      const cleanTitle = icon.name
        .replace(".svg", "")
        .replace(/([A-Z0-9])/g, " 1")
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
    <div className="flex flex-col w-full min-h-screen overflow-x-hidden bg-white text-black dark:bg-black dark:text-white transition-colors duration-300">
      <NavBar />
      <First />
      <LogoLoop
        logos={awsLogos}
        speed={100}
        direction="left"
        logoHeight={40}
        gap={40}
        scaleOnHover={true}
        fadeOut={true}
        pauseOnHover
        className="w-full pt-4"
      />
      <Third />
      <Second />
      <Fourth />
      <Fifth />
      <LogoLoop
        logos={awsLogos}
        speed={100}
        direction="left"
        logoHeight={40}
        gap={40}
        scaleOnHover={true}
        fadeOut={true}
        pauseOnHover
        className="w-full my-4"
      />
      <Footer />
    </div>
  )
}
export default Landing
