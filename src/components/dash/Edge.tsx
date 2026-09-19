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
} from "react";
import { getBezierPath, Position } from "@xyflow/react";
import cn from "cnfast";
import { graphStore, useGraph } from "#graph";
import { SocketType } from "../../types/nodes";

const nodeIdOf = (el: HTMLElement): string | undefined => el.closest<HTMLElement>("[data-id]")?.dataset.id;
const typeOf = (el: HTMLElement): SocketType | undefined => el.dataset.socket as SocketType | undefined;

interface EdgeApi {
  register: (el: HTMLElement, type: SocketType) => void;
  unregister: (el: HTMLElement, type: SocketType) => void;
  grab: (el: HTMLElement) => void;
  pending: HTMLElement | null;
}

const EdgeCtx = createContext<EdgeApi | null>(null);

interface SocketApi {
  ref: (el: HTMLElement | null) => void;
  grab: (e: ReactPointerEvent) => void;
  isPending: boolean;
}

const disconnected: SocketApi = {
  ref: () => {},
  grab: () => {},
  isPending: false,
};

export const useEdgeSocket = (type: SocketType): SocketApi => {
  const api = useContext(EdgeCtx);
  const apiRef = useRef(api);
  const socketRef = useRef<HTMLElement | null>(null);

  apiRef.current = api;

  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (el) {
        socketRef.current = el;
        apiRef.current?.register(el, type);
        return;
      }

      if (socketRef.current) {
        apiRef.current?.unregister(socketRef.current, type);
        socketRef.current = null;
      }
    },
    [type],
  );

  const grab = useCallback((e: ReactPointerEvent) => {
    e.stopPropagation();

    if (socketRef.current) {
      apiRef.current?.grab(socketRef.current);
    }
  }, []);

  if (!api) return disconnected;

  return {
    ref,
    grab,
    isPending: api.pending !== null && api.pending === socketRef.current,
  };
};

export const Socket = ({ type }: { type: SocketType }) => {
  const socket = useEdgeSocket(type);

  return (
    <span
      ref={socket.ref}
      data-socket={type}
      onPointerDown={socket.grab}
      className={cn(
        "absolute top-1/2 z-10 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border border-border transition-colors",
        type === SocketType.Input ? "-left-[7px]" : "-right-[7px]",
        socket.isPending ? "bg-blueprimary" : "bg-node hover:bg-[#999999]",
      )}
    />
  );
};

const isEmptyRect = (rect: DOMRect) => rect.width === 0 && rect.height === 0;

export default function EdgeLayer({ children }: { children: ReactNode }) {
  const { edges } = useGraph();
  const [pending, setPending] = useState<HTMLElement | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const visiblePaths = useRef(new Map<string, SVGPathElement>());
  const hitPaths = useRef(new Map<string, SVGPathElement>());
  const pendingPath = useRef<SVGPathElement | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const inputs = useRef(new Map<string, HTMLElement>());
  const outputs = useRef(new Map<string, HTMLElement>());
  const registry = (type: SocketType) => (type === SocketType.Input ? inputs.current : outputs.current);

  const edgesRef = useRef(edges);
  const pendingRef = useRef(pending);

  edgesRef.current = edges;
  pendingRef.current = pending;

  const api = useMemo<EdgeApi>(
    () => ({
      register: (el, type) => {
        const id = nodeIdOf(el);
        if (id) registry(type).set(id, el);
      },

      unregister: (el, type) => {
        const map = registry(type);
        for (const [id, socket] of map) if (socket === el) map.delete(id);
        setPending((current) => (current === el ? null : current));
      },

      grab: (el) => {
        const current = pendingRef.current;

        if (!current) {
          setPending(el);
          return;
        }

        if (current === el || typeOf(current) === typeOf(el)) {
          setPending(null);
          return;
        }

        const [output, input] = typeOf(current) === SocketType.Output ? [current, el] : [el, current];
        const from = nodeIdOf(output);
        const to = nodeIdOf(input);
        if (from && to) graphStore.connect(from, to);

        setPending(null);
      },

      pending,
    }),
    [pending],
  );

  useEffect(() => {
    if (!pending) return;

    const cancel = () => setPending(null);

    window.addEventListener("pointerdown", cancel);

    return () => {
      window.removeEventListener("pointerdown", cancel);
    };
  }, [pending]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      pointer.current = {
        x: event.clientX,
        y: event.clientY,
      };
    };

    window.addEventListener("pointermove", move);

    return () => {
      window.removeEventListener("pointermove", move);
    };
  }, []);

  useEffect(() => {
    let raf = 0;

    const draw = () => {
      const svg = svgRef.current;

      if (svg) {
        const host = svg.getBoundingClientRect();
        const board = svg.parentElement;
        const scale = board && board.offsetWidth > 0 ? host.width / board.offsetWidth : 1;
        const localX = (x: number) => (x - host.left) / scale;
        const localY = (y: number) => (y - host.top) / scale;

        const strokeWidth = (2 / scale).toFixed(3)
        const hitWidth = (14 / scale).toFixed(3)
        const dash = `${5 / scale} ${5 / scale}`
        const pendingDash = `${4 / scale} ${3 / scale}`

        for (const edge of edgesRef.current) {
          const visible = visiblePaths.current.get(edge.id);
          const hit = hitPaths.current.get(edge.id);

          const fromEl = outputs.current.get(edge.from);
          const toEl = inputs.current.get(edge.to);

          if (!visible || !hit || !fromEl || !toEl) continue;

          const from = fromEl.getBoundingClientRect();
          const to = toEl.getBoundingClientRect();

          if (isEmptyRect(from) || isEmptyRect(to)) {
            visible.setAttribute("d", "");
            hit.setAttribute("d", "");
            continue;
          }

          const [path] = getBezierPath({
            sourceX: localX(from.left + from.width / 2),
            sourceY: localY(from.top + from.height / 2),
            targetX: localX(to.left + to.width / 2),
            targetY: localY(to.top + to.height / 2),
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });

          visible.setAttribute("d", path);
          visible.setAttribute("stroke-width", strokeWidth);
          visible.setAttribute("stroke-dasharray", dash);
          hit.setAttribute("d", path);
          hit.setAttribute("stroke-width", hitWidth);
        }

        const dashed = pendingPath.current;
        const held = pendingRef.current;

        if (dashed && held) {
          const rect = held.getBoundingClientRect();
          const socket = { x: localX(rect.left + rect.width / 2), y: localY(rect.top + rect.height / 2) };
          const cursor = { x: localX(pointer.current.x), y: localY(pointer.current.y) };
          const fromOutput = typeOf(held) === SocketType.Output;
          const [source, target] = fromOutput ? [socket, cursor] : [cursor, socket];

          const [path] = getBezierPath({
            sourceX: source.x,
            sourceY: source.y,
            targetX: target.x,
            targetY: target.y,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });

          dashed.setAttribute("d", path);
          dashed.setAttribute("stroke-width", strokeWidth);
          dashed.setAttribute("stroke-dasharray", pendingDash);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <EdgeCtx.Provider value={api}>
      <svg
        ref={svgRef}
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        {edges.map((edge) => (
          <g key={edge.id}>
            <path
              ref={(el) => {
                if (el) {
                  hitPaths.current.set(edge.id, el);
                } else {
                  hitPaths.current.delete(edge.id);
                }
              }}
              d=""
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              className="pointer-events-auto cursor-pointer"
              onPointerDown={(event) => {
                event.stopPropagation();
                graphStore.removeEdge(edge.id);
              }}
            />

            <path
              ref={(el) => {
                if (el) visiblePaths.current.set(edge.id, el);
                else visiblePaths.current.delete(edge.id);
              }}
              d=""
              fill="none"
              stroke="#693cc5"
              strokeWidth={2}
              strokeDasharray="5 5"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="10"
                to="0"
                dur="0.5s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        ))}

        {pending && (
          <path
            ref={pendingPath}
            d=""
            fill="none"
            stroke="#999999"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        )}
      </svg>

      {children}
    </EdgeCtx.Provider>
  );
}
