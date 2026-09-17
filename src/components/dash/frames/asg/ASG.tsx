import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Frame from "../../Frame";

gsap.registerPlugin(useGSAP);

const ASG = ({ n, children }: { n: number; children: ReactNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [instances, setInstances] = useState<string[]>([]);
  const prevN = useRef(n);

  useEffect(() => {
    setInstances((prev) => {
      if (n > prev.length) {
        return [...prev, ...Array.from({ length: n - prev.length }, () => crypto.randomUUID())];
      }

      return prev;
    });
  }, [n]);

  useGSAP(
    () => {
      const elements = containerRef.current?.querySelectorAll(".itemmmmy");
      if (!elements) return;

      const previous = prevN.current;
      const current = Array.from(elements);

      // INCREMENT
      if (n > previous) {
        const added = current.slice(previous);

        gsap.fromTo(
          added,
          {
            scale: 0,
            opacity: 0,
          },
          {
            scale: 1,
            opacity: 1,
            duration: 0.3,
            stagger: 0.05,
            ease: "power2.out",
          },
        );
      }

      prevN.current = n;
    },
    {
      dependencies: [instances],
      scope: containerRef,
    },
  );

  useGSAP(
    () => {
      if (n >= prevN.current) return;
      const elements = containerRef.current?.querySelectorAll(".itemmmmy");
      if (!elements) return;

      const current = Array.from(elements);
      const count = prevN.current - n;
      const top = current.slice(0, Math.ceil(count / 2));
      const bottom = current.slice(-Math.floor(count / 2));
      const removed = [...top, ...bottom];

      gsap.to(removed, {
        scale: 0,
        opacity: 0,
        duration: 0.2,
        stagger: 0.05,
        ease: "power2.in",
        onComplete: () => {
          const removeIds = new Set(removed.map((el) => el.getAttribute("data-id")));

          setInstances((prev) => prev.filter((id) => !removeIds.has(id)));

          prevN.current = n;
        },
      });
    },
    {
      dependencies: [n],
      scope: containerRef,
    },
  );

  return (
    <div ref={containerRef}>
      <Frame name="ASG">
        {instances.map((id) => (
          <div key={id} data-id={id} className="itemmmmy">
            {children}
          </div>
        ))}
      </Frame>
    </div>
  );
};

export default ASG;
