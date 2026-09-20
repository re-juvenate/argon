// Lazy URL registry for the AWS architecture icons in src/assets/AWS-ICONS.
// Vite inlines each SVG as a data-URL (they're < 4 kB) — no runtime requests.
const urls = import.meta.glob<{ default: string }>("../../assets/AWS-ICONS/*.svg", {
  eager: true,
})

export type ServiceIcon = `${string}.svg`

/** Resolve `service.svg` to its URL; undefined when no icon exists. */
export const serviceIcon = (service: ServiceIcon): string | undefined => {
  const path = Object.keys(urls).find((key) => key.endsWith(`/${service}`))
  return path ? urls[path].default : undefined
}

/** Array of all available service icons with their resolved URLs */
export const allServiceIcons = Object.entries(urls).map(([path, mod]) => {
  const name = path.split("/").pop()!
  return {
    name,
    url: mod.default,
  }
})
