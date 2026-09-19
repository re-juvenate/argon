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

const nodeIdOf = (el: HTMLElement): string | undefined => el.closest<HTMLElement>("[data-id]")?.dataset.id;

interface EdgeApi {
  register: (el: HTMLElement) => void;
  unregister: (el: HTMLElement) => void;
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

export const useEdgeSocket = (): SocketApi => {
  const api = useContext(EdgeCtx);
  const apiRef = useRef(api);
  const socketRef = useRef<HTMLElement | null>(null);

  apiRef.current = api;

  const ref = useCallback((el: HTMLElement | null) => {
    if (el) {
      socketRef.current = el;
      apiRef.current?.register(el);
      return;
    }

    if (socketRef.current) {
      apiRef.current?.unregister(socketRef.current);
      socketRef.current = null;
    }
  }, []);

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

export const Socket = () => {
  const socket = useEdgeSocket();

  return (
    <span
      ref={socket.ref}
      onPointerDown={socket.grab}
      className={cn(
        "absolute -right-[7px] top-1/2 z-10 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border border-border transition-colors",
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
  const sockets = useRef(new Map<string, HTMLElement>());

  const edgesRef = useRef(edges);
  const pendingRef = useRef(pending);

  edgesRef.current = edges;
  pendingRef.current = pending;

  const api = useMemo<EdgeApi>(
    () => ({
      register: (el) => {
        const id = nodeIdOf(el);
        if (id) sockets.current.set(id, el);
      },

      unregister: (el) => {
        for (const [id, socket] of sockets.current) if (socket === el) sockets.current.delete(id);
        setPending((current) => (current === el ? null : current));
      },

      grab: (el) => {
        const current = pendingRef.current;

        if (!current) {
          setPending(el);
          return;
        }

        if (current === el) {
          setPending(null);
          return;
        }

        const from = nodeIdOf(current);
        const to = nodeIdOf(el);
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

        for (const edge of edgesRef.current) {
          const visible = visiblePaths.current.get(edge.id);
          const hit = hitPaths.current.get(edge.id);

          const fromEl = sockets.current.get(edge.from);
          const toEl = sockets.current.get(edge.to);

          if (!visible || !hit || !fromEl || !toEl) continue;

          const from = fromEl.getBoundingClientRect();
          const to = toEl.getBoundingClientRect();

          if (isEmptyRect(from) || isEmptyRect(to)) {
            visible.setAttribute("d", "");
            hit.setAttribute("d", "");
            continue;
          }

          const sx = localX(from.left + from.width / 2);
          const sy = localY(from.top + from.height / 2);
          const tx = localX(to.left + to.width / 2);
          const ty = localY(to.top + to.height / 2);
          const forward = tx >= sx;

          const [path] = getBezierPath({
            sourceX: sx,
            sourceY: sy,
            targetX: tx,
            targetY: ty,
            sourcePosition: forward ? Position.Right : Position.Left,
            targetPosition: forward ? Position.Left : Position.Right,
          });

          visible.setAttribute("d", path);
          hit.setAttribute("d", path);
        }

        const dashed = pendingPath.current;
        const from = pendingRef.current;

        if (dashed && from) {
          const rect = from.getBoundingClientRect();

          const sx = localX(rect.left + rect.width / 2);
          const sy = localY(rect.top + rect.height / 2);
          const tx = localX(pointer.current.x);
          const ty = localY(pointer.current.y);
          const forward = tx >= sx;

          const [path] = getBezierPath({
            sourceX: sx,
            sourceY: sy,
            targetX: tx,
            targetY: ty,
            sourcePosition: forward ? Position.Right : Position.Left,
            targetPosition: forward ? Position.Left : Position.Right,
          });

          dashed.setAttribute("d", path);
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
