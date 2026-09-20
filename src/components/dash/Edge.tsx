import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { getBezierPath, Position } from "@xyflow/react"
import cn from "cnfast"
import { edgeFlow, graphStore, useGraph, type GraphEdge } from "#graph"
import { SocketType } from "../../types/nodes"
import { useResults } from "./Simulation"
import ContextMenu, { type MenuAt } from "./ContextMenu"
import { fmt } from "./metrics"
import { TrashIcon, PackageIcon } from "@phosphor-icons/react/dist/ssr"

const EDGE_COLOR = "#693cc5"
const DROP_COLOR = "#e5484d"

const mix = (a: string, b: string, t: number) => {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [ar, ag, ab] = c(a)
  const [br, bg, bb] = c(b)
  const k = Math.min(1, Math.max(0, t))
  return `rgb(${Math.round(ar + (br - ar) * k)}, ${Math.round(ag + (bg - ag) * k)}, ${Math.round(ab + (bb - ab) * k)})`
}

const nodeIdOf = (el: HTMLElement): string | undefined => el.closest<HTMLElement>("[data-id]")?.dataset.id
const typeOf = (el: HTMLElement): SocketType | undefined => el.dataset.socket as SocketType | undefined

interface EdgeApi {
  register: (el: HTMLElement, type: SocketType) => void
  unregister: (el: HTMLElement, type: SocketType) => void
  grab: (el: HTMLElement) => void
  pending: HTMLElement | null
}

export const EdgeCtx = createContext<EdgeApi | null>(null)
export const useEdgeApi = () => useContext(EdgeCtx)

interface SocketApi {
  ref: (el: HTMLElement | null) => void
  grab: (e: ReactPointerEvent) => void
  isPending: boolean
}

const disconnected: SocketApi = {
  ref: () => {},
  grab: () => {},
  isPending: false,
}

export const useEdgeSocket = (type: SocketType): SocketApi => {
  const api = useContext(EdgeCtx)
  const apiRef = useRef(api)
  const socketRef = useRef<HTMLElement | null>(null)

  apiRef.current = api

  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (el) {
        socketRef.current = el
        apiRef.current?.register(el, type)
        return
      }

      if (socketRef.current) {
        apiRef.current?.unregister(socketRef.current, type)
        socketRef.current = null
      }
    },
    [type],
  )

  const grab = useCallback((e: ReactPointerEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (socketRef.current) {
      apiRef.current?.grab(socketRef.current)
    }
  }, [])

  if (!api) return disconnected

  return {
    ref,
    grab,
    isPending: api.pending !== null && api.pending === socketRef.current,
  }
}

export const Socket = ({ type }: { type: SocketType }) => {
  const socket = useEdgeSocket(type)

  return (
    <span
      ref={socket.ref}
      data-socket={type}
      draggable={false}
      onPointerDown={socket.grab}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      className={cn(
        "absolute top-1/2 z-10 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border border-border transition-colors select-none [-webkit-user-drag:none]",
        "before:absolute before:-inset-4 before:content-[''] before:rounded-full",
        type === SocketType.Input ? "-left-[7px]" : "-right-[7px]",
        socket.isPending ? "bg-blueprimary" : "bg-node hover:bg-[#999999]",
      )}
    />
  )
}

const isEmptyRect = (rect: DOMRect) => rect.width === 0 && rect.height === 0

export default function EdgeLayer({ children }: { children: ReactNode }) {
  const graph = useGraph()
  const { edges } = graph
  const results = useResults()
  const [pending, setPending] = useState<HTMLElement | null>(null)
  const [menu, setMenu] = useState<{ at: MenuAt; edge: GraphEdge } | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const visiblePaths = useRef(new Map<string, SVGPathElement>())
  const hitPaths = useRef(new Map<string, SVGPathElement>())
  const pendingPath = useRef<SVGPathElement | null>(null)
  const labels = useRef(new Map<string, SVGTextElement>())
  const graphRef = useRef(graph)
  const resultsRef = useRef(results)
  graphRef.current = graph
  resultsRef.current = results
  const pointer = useRef({ x: 0, y: 0 })
  const dragStart = useRef({ x: 0, y: 0 })
  const inputs = useRef(new Map<string, HTMLElement>())
  const outputs = useRef(new Map<string, HTMLElement>())
  const registry = (type: SocketType) => (type === SocketType.Input ? inputs.current : outputs.current)

  const edgesRef = useRef(edges)
  const pendingRef = useRef(pending)

  edgesRef.current = edges
  pendingRef.current = pending

  const api = useMemo<EdgeApi>(
    () => ({
      register: (el, type) => {
        const id = nodeIdOf(el)
        if (id) registry(type).set(id, el)
      },

      unregister: (el, type) => {
        const map = registry(type)
        for (const [id, socket] of map) if (socket === el) map.delete(id)
        setPending((current) => (current === el ? null : current))
      },

      grab: (el) => {
        const current = pendingRef.current

        if (!current) {
          setPending(el)
          dragStart.current = { ...pointer.current }
          return
        }

        if (current === el || typeOf(current) === typeOf(el)) {
          setPending(null)
          return
        }

        const [output, input] = typeOf(current) === SocketType.Output ? [current, el] : [el, current]
        const from = nodeIdOf(output)
        const to = nodeIdOf(input)
        if (from && to) graphStore.connect(from, to)

        setPending(null)
      },

      pending,
    }),
    [pending],
  )

  useEffect(() => {
    if (!pending) return

    const cancel = () => setPending(null)

    const up = (event: PointerEvent) => {
      const dx = event.clientX - dragStart.current.x
      const dy = event.clientY - dragStart.current.y
      if (Math.hypot(dx, dy) < 5) return // Allow click-to-connect to continue

      const hitSocket = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((el) => (el as HTMLElement).closest<HTMLElement>("[data-socket]"))
        .find(Boolean)

      if (hitSocket && hitSocket !== pending) {
        api.grab(hitSocket)
        return
      }

      // If dropped on a node, connect to its opposite socket
      const hitNode = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((el) => (el as HTMLElement).closest<HTMLElement>("[data-node]"))
        .find(Boolean)

      const targetId = hitNode ? nodeIdOf(hitNode) : undefined
      if (targetId) {
        const sourceType = typeOf(pending)
        const targetSocket = sourceType === SocketType.Output ? inputs.current.get(targetId) : outputs.current.get(targetId)

        if (targetSocket && targetSocket !== pending) {
          api.grab(targetSocket)
          return
        }
      }

      setPending(null)
    }

    window.addEventListener("pointerdown", cancel)
    window.addEventListener("pointerup", up)

    return () => {
      window.removeEventListener("pointerdown", cancel)
      window.removeEventListener("pointerup", up)
    }
  }, [pending, api])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      pointer.current = {
        x: event.clientX,
        y: event.clientY,
      }
    }

    window.addEventListener("pointermove", move)

    return () => {
      window.removeEventListener("pointermove", move)
    }
  }, [])

  useEffect(() => {
    let raf = 0

    const draw = () => {
      const svg = svgRef.current

      if (svg) {
        const host = svg.getBoundingClientRect()
        const board = svg.parentElement
        const scale = board && board.offsetWidth > 0 ? host.width / board.offsetWidth : 1
        const localX = (x: number) => (x - host.left) / scale
        const localY = (y: number) => (y - host.top) / scale

        const strokeWidth = (2 / scale).toFixed(3)
        const hitWidth = (14 / scale).toFixed(3)
        const dash = `${5 / scale} ${5 / scale}`
        const pendingDash = `${4 / scale} ${3 / scale}`

        for (const edge of edgesRef.current) {
          const visible = visiblePaths.current.get(edge.id)
          const hit = hitPaths.current.get(edge.id)

          const fromEl = outputs.current.get(edge.from)
          const toEl = inputs.current.get(edge.to)

          if (!visible || !hit || !fromEl || !toEl) continue

          const from = fromEl.getBoundingClientRect()
          const to = toEl.getBoundingClientRect()

          if (isEmptyRect(from) || isEmptyRect(to)) {
            visible.setAttribute("d", "")
            hit.setAttribute("d", "")
            const hidden = labels.current.get(edge.id)
            if (hidden) hidden.textContent = ""
            continue
          }

          const [path, labelX, labelY] = getBezierPath({
            sourceX: localX(from.left + from.width / 2),
            sourceY: localY(from.top + from.height / 2),
            targetX: localX(to.left + to.width / 2),
            targetY: localY(to.top + to.height / 2),
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          })

          const up = resultsRef.current.get(edge.from)
          const flow = up ? edgeFlow(graphRef.current, edge, up.throughput).value : undefined
          const drop = resultsRef.current.get(edge.to)?.drop.dropRate.value ?? 0

          visible.setAttribute("d", path)
          visible.setAttribute("stroke", mix(EDGE_COLOR, DROP_COLOR, drop))
          visible.setAttribute("stroke-width", strokeWidth)
          visible.setAttribute("stroke-dasharray", dash)
          hit.setAttribute("d", path)
          hit.setAttribute("stroke-width", hitWidth)

          const label = labels.current.get(edge.id)
          if (label) {
            label.setAttribute("x", String(labelX))
            label.setAttribute("y", String(labelY - 6 / scale))
            label.setAttribute("font-size", String(11 / scale))
            label.textContent = flow === undefined ? "" : `${fmt(flow)} Mbps${edge.avgBytes ? ` | ${edge.avgBytes} B` : ""}`
          }
        }

        const dashed = pendingPath.current
        const held = pendingRef.current

        if (dashed && held) {
          const rect = held.getBoundingClientRect()
          const socket = { x: localX(rect.left + rect.width / 2), y: localY(rect.top + rect.height / 2) }
          const cursor = { x: localX(pointer.current.x), y: localY(pointer.current.y) }
          const fromOutput = typeOf(held) === SocketType.Output
          const [source, target] = fromOutput ? [socket, cursor] : [cursor, socket]

          const [path] = getBezierPath({
            sourceX: source.x,
            sourceY: source.y,
            targetX: target.x,
            targetY: target.y,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          })

          dashed.setAttribute("d", path)
          dashed.setAttribute("stroke-width", strokeWidth)
          dashed.setAttribute("stroke-dasharray", pendingDash)
        }
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <EdgeCtx.Provider value={api}>
      <svg ref={svgRef} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {edges.map((edge) => (
          <g key={edge.id} opacity={edge.suggested ? 0.5 : 1}>
            <path
              ref={(el) => {
                if (el) {
                  hitPaths.current.set(edge.id, el)
                } else {
                  hitPaths.current.delete(edge.id)
                }
              }}
              d=""
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              className={edge.suggested ? "pointer-events-none" : "pointer-events-auto cursor-pointer"}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setMenu({ at: { x: event.clientX, y: event.clientY }, edge })
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setMenu({ at: { x: event.clientX, y: event.clientY }, edge })
              }}
            />

            <path
              ref={(el) => {
                if (el) visiblePaths.current.set(edge.id, el)
                else visiblePaths.current.delete(edge.id)
              }}
              d=""
              fill="none"
              stroke="#693cc5"
              strokeWidth={2}
              strokeDasharray="5 5"
            >
              <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.5s" repeatCount="indefinite" />
            </path>

            <text
              ref={(el) => {
                if (el) labels.current.set(edge.id, el)
                else labels.current.delete(edge.id)
              }}
              textAnchor="middle"
              fill="#999999"
              fontFamily="monospace"
              className="select-none"
            />
          </g>
        ))}

        {pending && <path ref={pendingPath} d="" fill="none" stroke="#999999" strokeWidth={2} strokeDasharray="4 3" />}
      </svg>

      {children}

      {menu && (
        <ContextMenu
          at={menu.at}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Avg bytes",
              icon: <PackageIcon />,
              input: {
                value: menu.edge.avgBytes,
                placeholder: "model",
                onCommit: (raw) => {
                  const avgBytes = Number(raw)
                  graphStore.setEdgeBytes(menu.edge.id, raw !== "" && Number.isFinite(avgBytes) && avgBytes > 0 ? avgBytes : undefined)
                },
              },
            },
            { label: "Delete edge", icon: <TrashIcon />, danger: true, onSelect: () => graphStore.removeEdge(menu.edge.id) },
          ]}
        />
      )}
    </EdgeCtx.Provider>
  )
}
