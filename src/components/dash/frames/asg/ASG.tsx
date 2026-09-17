import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Frame from "../../Frame";
import EC2 from "../../nodes/ec2/EC2";

const ASG = ({ n }: { n: number }) => {
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
      const elements = containerRef.current?.querySelectorAll(".ec2-instance");

      if (!elements) return;

      const previous = prevN.current;

      // Increment
      if (n > previous) {
        const newElements = Array.from(elements).slice(previous);

        gsap.fromTo(
          newElements,
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

      // Decrement
      if (n < previous) {
        const removedElements = Array.from(elements).slice(n);

        gsap.to(removedElements, {
          scale: 0,
          opacity: 0,
          duration: 0.2,
          stagger: 0.05,
          ease: "power2.in",
          onComplete: () => {
            setInstances((prev) => prev.slice(0, n));
          },
        });
      }

      prevN.current = n;
    },
    {
      dependencies: [n, instances],
      scope: containerRef,
    },
  );

  return (
    <div ref={containerRef}>
      <Frame name="ASG">
        {instances.map((id) => (
          <div key={id} className="ec2-instance">
            <EC2 />
          </div>
        ))}
      </Frame>
    </div>
  );
};

export default ASG;
