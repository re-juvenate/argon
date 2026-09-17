import { useGSAP } from "@gsap/react";
import Node from "../../Node";
import { useRef } from "react";
import gsap from "gsap";

interface QueueProps {
  n: number;
  speed: number;
  state: boolean;
}

const Queue = ({ n, speed, state }: QueueProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!state || !containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const itemWidth = containerWidth / n;

      gsap.set(".queue-item", {
        width: itemWidth - 8,
        x: -itemWidth,
      });

      const tween = gsap.to(".queue-item", {
        x: containerWidth,
        duration: speed,
        repeat: -1,
        ease: "back.out",
        stagger: {
          each: speed / n,
          repeat: -1,
        },
      });

      return () => {
        tween.kill();
      };
    },
    { scope: containerRef, dependencies: [state, n, speed] },
  );

  return (
    <div ref={containerRef} className="relative w-full h-16 overflow-hidden flex items-center">
      {state &&
        Array.from({ length: n }).map((_, i) => (
          <div key={i} className="queue-item absolute leftX-0 h-12 bg-blueprimary border-[0.5px]" />
        ))}
    </div>
  );
};

const SQS = () => {
  return (
    <Node
      color="#c72161"
      name="SQS"
      visibleChildren={<Queue n={10} speed={5} state={true} />}
    ></Node>
  );
};

export default SQS;
