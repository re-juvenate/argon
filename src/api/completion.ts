import { z } from "zod"
import { graphEdgeSchema, graphNodeSchema, graphSchema, nodeUpdateSchema, type Graph, type Suggestion } from "#graph"

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:8000"

const SESSION_KEY = "argon.session"
const EXPIRY_MARGIN_MS = 60_000

const sessionSchema = z.object({ token: z.string().min(1), session_id: z.string().min(1), expires_at: z.number(), expires_in: z.number() })

const completionSchema = z.object({
  session_id: z.string(),
  rationale: z.string(),
  graph: graphSchema,
  added: z.object({
    nodes: z.array(graphNodeSchema),
    edges: z.array(graphEdgeSchema),
    removedEdges: z.array(z.string()).default([]),
    updates: z.array(nodeUpdateSchema).default([]),
  }),
})

export interface Session {
  token: string
  sessionId: string
  expiresAt: number
}

export interface Completion {
  sessionId: string
  rationale: string
  graph: Graph
  added: Suggestion
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message)
  }
}

const readSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    return typeof s.token === "string" && typeof s.expiresAt === "number" ? s : null
  } catch {
    return null
  }
}

const writeSession = (session: Session | null) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable */
  }
}

const alive = (s: Session | null): s is Session => s !== null && s.expiresAt - EXPIRY_MARGIN_MS > Date.now()

async function request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include", ...init })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* non-json body */
    }
    const retry = Number(res.headers.get("retry-after"))
    throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail), Number.isFinite(retry) && retry > 0 ? retry * 1000 : undefined)
  }
  return schema.parse(await res.json())
}

let negotiating: Promise<Session> | null = null

export function connect(force = false): Promise<Session> {
  const cached = force ? null : readSession()
  if (alive(cached)) return Promise.resolve(cached)
  negotiating ??= request("/agent/session", { method: "POST" }, sessionSchema)
    .then((s) => {
      const session = { token: s.token, sessionId: s.session_id, expiresAt: s.expires_at * 1000 }
      writeSession(session)
      return session
    })
    .finally(() => {
      negotiating = null
    })
  return negotiating
}

export const currentSession = (): Session | null => (alive(readSession()) ? readSession() : null)

export const disconnect = () => writeSession(null)

export async function complete(graph: Graph, prompt?: string): Promise<Completion> {
  const send = async (session: Session) =>
    request(
      "/agent/complete",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ graph, prompt: prompt?.trim() || undefined }),
      },
      completionSchema,
    )

  let raw
  try {
    raw = await send(await connect())
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error
    raw = await send(await connect(true))
  }

  return { sessionId: raw.session_id, rationale: raw.rationale, graph: raw.graph as Graph, added: raw.added as Suggestion }
}
