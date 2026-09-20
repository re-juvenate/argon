export const INTERACTION_IDLE_MS = 1000

let pointerDown = false
let lastAt = 0
let installed = false

const touch = () => {
  lastAt = Date.now()
}

export function installInteractionTracker() {
  if (installed || typeof document === "undefined") return
  installed = true
  document.addEventListener(
    "pointerdown",
    () => {
      pointerDown = true
      touch()
    },
    true,
  )
  const release = () => {
    pointerDown = false
    touch()
  }
  document.addEventListener("pointerup", release, true)
  document.addEventListener("pointercancel", release, true)
  document.addEventListener("pointermove", () => pointerDown && touch(), true)
  document.addEventListener("keydown", touch, true)
  document.addEventListener("dragstart", touch, true)
  document.addEventListener("dragover", touch, true)
  document.addEventListener("drop", touch, true)
}

export const isInteracting = (now = Date.now()): boolean =>
  pointerDown || now - lastAt < INTERACTION_IDLE_MS || document.querySelector("[data-dragging], [data-add-menu]") !== null
