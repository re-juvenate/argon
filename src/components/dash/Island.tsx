import { useRef, type RefObject } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";

gsap.registerPlugin(Draggable, InertiaPlugin);

let front = 1;
const bringToFront = (el: HTMLElement) => {
  el.style.zIndex = String(++front);
};

const overlapArea = (a: DOMRect, b: DOMRect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

interface IslandOptions {
  /** Optional drag handle inside the island; defaults to the island element itself. */
  handle?: RefObject<HTMLElement | null>;
  /**
   * Flow islands (nodes) join a frame's layout flow when dropped inside one,
   * and are lifted back onto the board (absolute) when dropped outside.
   * Non-flow islands (frames) stay absolutely positioned and keep their
   * on-screen position through any reparent.
   */
  flow?: boolean;
}

/**
 * Makes an element an independently draggable "island" on the board.
 *
 * Each island owns its own Draggable — no global pass, no React re-renders
 * during a drag (pure GSAP transforms). On release the island reparents itself:
 * dropped over a `[data-frame-body]` it joins that frame, dropped anywhere else
 * it becomes a direct child of the board, landing exactly where it was released.
 */
export const useIsland = <T extends HTMLElement = HTMLDivElement>({
  handle,
  flow = false,
}: IslandOptions = {}) => {
  const ref = useRef<T | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      const board = el?.closest<HTMLElement>("[data-island-board]");
      if (!el || !board) return;

      // Islands need absolute positioning when they sit directly on the board
      // (frames always; nodes only while top-level). Auto offsets + inline
      // left/top keep them exactly where JSX places them.
      if (!flow || el.parentElement === board) {
        el.style.position = "absolute";
      }

      const trigger = handle?.current ?? undefined;

      const [instance] = Draggable.create(el, {
        type: "x,y",
        trigger,
        bounds: board,
        inertia: true,
        edgeResistance: 1,
        zIndexBoost: false,
        onPress(this: Draggable) {
          // The island may have been reparented since creation/last press —
          // re-measure so stale bounds can't clamp the drag.
          this.applyBounds(board);
        },
        onDragStart(this: Draggable) {
          bringToFront(this.target as HTMLElement);
        },
        onDragEnd(this: Draggable) {
          const parent = el.parentElement;
          if (!parent) return;

          // Decide by where the ISLAND is, not the pointer: pulling a node out
          // of a frame must take it out even though the pointer may lag behind.
          const r = el.getBoundingClientRect();
          const hit = (
            document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2) as HTMLElement[]
          ).filter((n) => !el.contains(n));
          const ownFrame = el.closest<HTMLElement>("[data-frame]");
          const hitFrame = hit.find((n) => n.dataset.frame !== undefined);
          const otherFrame = hitFrame && hitFrame !== ownFrame ? hitFrame : undefined;
          const rawBody = otherFrame?.querySelector<HTMLElement>(":scope > [data-frame-body]");
          // Collapsed frames don't accept drops (their body is display:none).
          const body = rawBody && !rawBody.classList.contains("hidden") ? rawBody : undefined;

          // A node leaves its frame once the majority of it is outside —
          // not merely when its center point crosses the edge.
          const ownRect = ownFrame?.getBoundingClientRect();
          const mostlyOutside =
            !ownRect || overlapArea(r, ownRect) < (r.width * r.height) / 2;

          // Reparenting must cancel the inertia throw, or the tween keeps
          // writing transforms after the move and flings the island away.
          // The throw tween may be created just before OR just after this
          // handler runs, so kill across the whole release task, then re-assert
          // the settled position on the next frame.
          const commit = (place: () => () => void) => {
            const settle = place();
            gsap.killTweensOf(el, "x,y");
            queueMicrotask(() => gsap.killTweensOf(el, "x,y"));
            requestAnimationFrame(() => {
              gsap.killTweensOf(el, "x,y");
              settle();
            });
          };

          // Reparent `el` under `newParent` while keeping its EXACT on-screen
          // position. Order matters: capture the visual rect with the drag
          // transform applied, strip the transform, THEN measure the new spot —
          // otherwise the compensation delta composes with the stale transform
          // and the island visibly snaps back to its old slot.
          const moveTo = (newParent: HTMLElement) => {
            const prev = el.getBoundingClientRect();
            gsap.set(el, { x: 0, y: 0 });
            el.style.position = "absolute";
            el.style.left = "";
            el.style.top = "";
            bringToFront(el);
            newParent.appendChild(el);
            const now = el.getBoundingClientRect();
            const dx = prev.left - now.left;
            const dy = prev.top - now.top;
            gsap.set(el, { x: dx, y: dy });
            return () => gsap.set(el, { x: dx, y: dy });
          };

          if (flow) {
            if (parent === board) {
              // Top-level node dropped on a frame -> join that frame's flow.
              if (!body) return; // stays on the board: let the throw fly
              commit(() => {
                el.style.position = "";
                el.style.left = "";
                el.style.top = "";
                gsap.set(el, { x: 0, y: 0 });
                body.appendChild(el);
                return () => gsap.set(el, { x: 0, y: 0 });
              });
            } else if (body) {
              // Node in a frame, released over another frame -> hop into its flow.
              commit(() => {
                if (body !== parent) {
                  el.style.position = "";
                  el.style.left = "";
                  el.style.top = "";
                  gsap.set(el, { x: 0, y: 0 });
                  body.appendChild(el);
                }
                return () => gsap.set(el, { x: 0, y: 0 });
              });
            } else if (mostlyOutside) {
              // Majority of the node is out of its frame -> leave, landing
              // exactly at the release position.
              commit(() => moveTo(board));
            } else {
              // Still mostly inside its own frame -> back into the flow so
              // stacking stays clean.
              commit(() => {
                gsap.set(el, { x: 0, y: 0 });
                return () => gsap.set(el, { x: 0, y: 0 });
              });
            }
          } else {
            // Frame island (always absolute).
            if (hitFrame && hitFrame === ownFrame) return; // dropped on itself: throw flies
            const target = body ?? board;
            if (target === parent) return; // already there: throw flies
            commit(() => moveTo(target));
          }
        },
      });

      return () => {
        instance.kill();
      };
    },
    { scope: ref, dependencies: [handle, flow] },
  );

  return ref;
};
