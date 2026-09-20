import type { Graph } from "#graph"

export const SETTLE_MS = 2000
export const INTERACTION_SETTLE_MS = 1000
export const MIN_SPACING_MS = 5000
export const ERROR_BACKOFF_MS = 10_000
export const MAX_BACKOFF_MS = 120_000

export enum Phase {
  Idle = "idle",
  Settling = "settling",
  InFlight = "in-flight",
  Overlay = "overlay",
  Blocked = "blocked",
  Editing = "editing",
  Off = "off",
}

export interface Signals {
  now: number
  fingerprint: string
  overlay: boolean
  enabled: boolean
  visible: boolean
  session: boolean
  interacting: boolean
}

export const fingerprintOf = (graph: Graph): string =>
  JSON.stringify({
    n: graph.nodes.map((n) => [n.id, n.service, n.parentId ?? null, n.config]),
    e: graph.edges.map((e) => [e.from, e.to, e.avgBytes ?? null]),
  })

export class CompletionDirector {
  private lastSeen = ""
  private lastSent = ""
  private changedAt = 0
  private nextAllowedAt = 0
  private failures = 0
  private inFlight = false

  observe(fingerprint: string, now: number) {
    if (fingerprint === this.lastSeen) return
    this.lastSeen = fingerprint
    this.changedAt = now
  }

  phase(s: Signals): Phase {
    this.observe(s.fingerprint, s.now)
    if (s.interacting) this.changedAt = Math.max(this.changedAt, s.now - SETTLE_MS + INTERACTION_SETTLE_MS)
    if (!s.enabled || !s.visible || !s.session) return Phase.Off
    if (this.inFlight) return Phase.InFlight
    if (s.overlay) return Phase.Overlay
    if (s.interacting) return Phase.Editing
    if (s.now < this.nextAllowedAt) return Phase.Blocked
    if (this.lastSeen === this.lastSent) return Phase.Idle
    return s.now - this.changedAt >= SETTLE_MS ? Phase.Idle : Phase.Settling
  }

  shouldFire(s: Signals): boolean {
    return this.phase(s) === Phase.Idle && this.lastSeen !== this.lastSent
  }

  begin(fingerprint: string, now: number) {
    this.inFlight = true
    this.lastSent = fingerprint
    this.nextAllowedAt = now + MIN_SPACING_MS
  }

  succeed() {
    this.inFlight = false
    this.failures = 0
  }

  fail(now: number, retryAfterMs?: number) {
    this.inFlight = false
    this.failures += 1
    const backoff = retryAfterMs ?? Math.min(MAX_BACKOFF_MS, ERROR_BACKOFF_MS * 2 ** (this.failures - 1))
    this.nextAllowedAt = now + backoff
  }

  retryAt(): number {
    return this.nextAllowedAt
  }
}
