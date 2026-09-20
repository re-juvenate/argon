import { TryOut } from "./elements/TryOut"
import { RectangularTextReveal } from "./elements/textReveal"

const First = () => {
  return (
    <div className="relative isolate w-full h-screen overflow-hidden text-black dark:text-white bg-white dark:bg-black transition-colors duration-300">
      <main className="relative z-10 w-full h-full flex flex-col justify-end items-start p-6 pb-20 md:p-12 md:pb-24 gap-4">
        <div className="flex flex-col items-start gap-4">
          <RectangularTextReveal className="" baseColor="#7ec835">
            <span className="text-7xl md:text-9xl font-against tracking-tight leading-none">Argon</span> <br />
            <span className="text-lg md:text-xl select-none drop-shadow-md">Simulate, review, optimize and deploy your production</span>
          </RectangularTextReveal>
          <TryOut href="/graph">Try it out</TryOut>
        </div>
      </main>
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover -z-10 opacity-80"
        style={{ filter: "brightness(1.2) contrast(1.2) grayscale(0.2)" }}
      >
        <source src="/Videos/hero.mp4" type="video/mp4" />
      </video>
    </div>
  )
}

export default First
