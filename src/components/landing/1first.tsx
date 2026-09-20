import { TryOut } from "./elements/TryOut"
import heroVideo from "../../assets/videos/hero.mp4"

const First = () => {
  return (
    <div className="relative w-full h-screen overflow-hidden text-white">
      <video autoPlay loop muted playsInline className="absolute top-0 left-0 w-full h-full object-cover -z-10">
        <source src={heroVideo} type="video/mp4" />
      </video>
      <div className="absolute inset-0 -z-10" aria-hidden="true" />
      <main className="relative z-10 w-full h-full flex flex-col justify-end items-start p-6 gap-4">
        <div className="flex flex-col items-start gap-4">
          <h1 className="text-9xl font-against">Argon</h1>
          <p className="text-xl select-none drop-shadow-md">Simulate, review, optimize and deploy your production</p>
          <TryOut href="/graph">Try it out</TryOut>
        </div>
      </main>
    </div>
  )
}

export default First
