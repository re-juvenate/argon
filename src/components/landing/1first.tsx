import { TryOut } from "./elements/TryOut"

const First = () => {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <video autoPlay loop muted playsInline className="fixed top-0 left-0 w-full h-full object-cover -z-10">
        <source src="YOUR_VIDEO_URL_HERE.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/30 -z-10" aria-hidden="true" />
      <main className="relative z-10 w-full h-full flex flex-col justify-end items-end p-6 gap-4">
        <TryOut href="/graph">Try it out</TryOut>
        <div className="flex flex-col items-end gap-1">
          <img src="YOUR_LOGO_URL_HERE.svg" alt="Logo" className="w-8 h-8 object-contain" />
          <p className="text-xs text-white/80 select-none drop-shadow-md">Simulate, review, optimize and deploy your production</p>
        </div>
      </main>
    </div>
  )
}

export default First
