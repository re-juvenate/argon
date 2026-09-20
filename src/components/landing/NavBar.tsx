"use client"

import React, { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP)
}

const BRAND = "Argon"

interface NavLinkItem {
  label: string
  href: string
}

const NAV_LINKS: NavLinkItem[] = [
  { label: "Home", href: "/" },
  { label: "Work", href: "/work" },
  { label: "Universe", href: "/universe" },
  { label: "Contact", href: "/contact" },
]

interface SocialLinkItem {
  label: string
  href: string
}

const SOCIAL_LINKS: SocialLinkItem[] = [
  { label: "LinkedIn", href: "https://linkedin.com" },
  { label: "Instagram", href: "https://instagram.com" },
  { label: "X / Twitter", href: "https://x.com" },
]

interface NewsItem {
  source: string
  date: string
  year: number
  description: string
  type: string
  href: string
  logo: { text: string; className: string }
}

const NEWS: NewsItem[] = [
  {
    source: "Awwwards",
    date: "Jun. 7",
    year: 2026,
    description: "Argon",
    type: "Award",
    href: "#",
    logo: { text: "w.", className: "bg-[#ff5a26] text-white text-8xl font-black" },
  },
  {
    source: "Forbes",
    date: "May. 5",
    year: 2026,
    description: "Teenagers Are Earning Six Figures Behind The Scenes Of The Creator Economy.",
    type: "Publication",
    href: "#",
    logo: { text: "Forbes", className: "bg-neutral-900 text-white text-4xl font-serif font-bold" },
  },
  {
    source: "Billboard",
    date: "Apr. 20",
    year: 2026,
    description: 'Our very own Themis "Reit" Chrysafidis was recently featured on Billboard.',
    type: "Publication",
    href: "#",
    logo: { text: "billboard", className: "bg-white text-black text-3xl font-black tracking-tight" },
  },
  {
    source: "Your Creative Media",
    date: "Mar. 6",
    year: 2026,
    description: "Stüssy concept design featured by Your Creative Media.",
    type: "Feature",
    href: "#",
    logo: { text: "S", className: "bg-black text-white text-7xl font-black" },
  },
]

type NotchedProps<T extends React.ElementType> = {
  as?: T
  className?: string
} & React.ComponentPropsWithoutRef<T>

const Notched = <T extends React.ElementType = "div">({ as, className = "", style, ...props }: NotchedProps<T>) => {
  const Tag = as || "div"
  return (
    <Tag
      className={`corner-scoop ${className}`}
      style={
        {
          borderRadius: "9px",
          cornerShape: "scoop",
          WebkitCornerShape: "scoop",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

const ArrowRight = ({ className = "size-5" }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M4 12h16M14 6l6 6-6 6" />
  </svg>
)

const CloseIcon = ({ className = "size-5" }: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className={className}>
    <path d="M5 5l14 14M19 5L5 19" />
  </svg>
)

const NewsCard = ({ source, date, year, description, type, href, logo }: NewsItem) => (
  <Notched
    as="a"
    href={href}
    data-news
    className="group flex min-h-0 flex-1 justify-between gap-4 bg-neutral-800 p-5 text-white transition-colors hover:bg-neutral-700"
  >
    <div className="flex flex-col justify-between">
      <div>
        <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          {source}
          <ArrowRight className="size-4" />
          <span>
            {date} <em className="text-base font-normal">({year})</em>
          </span>
        </h3>
        <p className="mt-2 max-w-[38ch] text-sm leading-tight text-neutral-400">{description}</p>
      </div>
      <span className="text-sm text-neutral-500">({type})</span>
    </div>

    <div className={`grid aspect-square h-full max-h-[169px] shrink-0 place-items-center rounded-2xl ${logo.className}`}>{logo.text}</div>
  </Notched>
)

const NavLink = ({ label, href, onClick }: NavLinkItem & { onClick: () => void }) => (
  <li data-link className="border-b border-white/10">
    <a
      href={href}
      onClick={onClick}
      className="group flex items-center justify-between py-3 text-neutral-500 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
    >
      <span className="text-[clamp(2.75rem,5vw,4rem)] font-medium leading-none tracking-tighter">{label}</span>
      <ArrowRight className="mr-4 size-5 transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  </li>
)

export default function Navbar() {
  const [open, setOpen] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const close = () => setOpen(false)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add("(prefers-reduced-motion: no-preference)", () => build(1))
      mm.add("(prefers-reduced-motion: reduce)", () => build(0.01))

      function build(speed: number) {
        timeline.current = gsap
          .timeline({
            paused: true,
            defaults: { ease: "power3.out" },
            onStart: () => closeRef.current?.focus(),
            onReverseComplete: () => triggerRef.current?.focus(),
          })
          .to(rootRef.current, { autoAlpha: 1, duration: 0.3 * speed }, 0)
          .from("[data-panel]", { xPercent: 8, autoAlpha: 0, duration: 0.7 * speed }, 0)
          .from("[data-news]", { xPercent: -8, autoAlpha: 0, duration: 0.6 * speed, stagger: 0.07 }, 0.05)
          .from("[data-link]", { yPercent: 40, autoAlpha: 0, duration: 0.6 * speed, stagger: 0.07 }, 0.2)
          .from("[data-footer]", { autoAlpha: 0, duration: 0.4 * speed }, 0.4)
      }
    },
    { scope: rootRef },
  )

  useEffect(() => {
    timeline.current?.[open ? "play" : "reverse"]()
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && close()
    document.addEventListener("keydown", onKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-4 text-white mix-blend-difference">
        <a href="/" className="text-lg font-semibold tracking-tight">
          {BRAND}
        </a>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="site-menu"
          className="text-lg font-medium tracking-tight hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Menu
        </button>
      </header>

      <div
        ref={rootRef}
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.target === e.currentTarget && close()}
        className="invisible fixed inset-0 z-50 flex gap-4 bg-black/50 p-2 opacity-0 backdrop-blur-sm sm:p-5"
      >
        {/* News column (desktop only) */}
        <aside aria-label="Latest news" className="hidden max-w-[610px] flex-1 flex-col gap-4 lg:flex">
          {NEWS.map((item) => (
            <NewsCard key={item.source} {...item} />
          ))}

          <Notched
            as="a"
            href="#"
            data-news
            className="flex items-center justify-between bg-white px-4 py-4 text-black transition-colors hover:bg-neutral-200"
          >
            More News
            <ArrowRight />
          </Notched>
        </aside>

        <Notched
          as="nav"
          data-panel
          aria-label="Main"
          className="ml-auto flex w-full flex-col bg-neutral-800/90 p-6 text-white backdrop-blur-xl md:w-[466px]"
        >
          <div className="flex justify-end">
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="rounded p-1 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-white"
            >
              <CloseIcon />
            </button>
          </div>

          <ul className="mt-8">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.label} {...link} onClick={close} />
            ))}
          </ul>

          <div data-footer className="mt-auto flex flex-col gap-4 pb-2 text-sm">
            <span className="text-neutral-400">Media</span>
            <ul className="flex flex-col gap-1">
              {SOCIAL_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noreferrer" className="font-medium tracking-tight hover:text-neutral-400">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Notched>
      </div>
    </>
  )
}
