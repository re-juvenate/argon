import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import { KINESIS_DEFAULTS, type KinesisConfig } from "#math/kinesis/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

// Stream viz: records flow through shard lanes at staggered speeds — shards
// that stay visually independent of each other, like partition keys.
const ShardStreams = ({ shards, color }: { shards: number; color: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);

  useGSAP(
    () => {
      const tweens: gsap.core.Tween[] = [];
      dotRefs.current.forEach((dot, i) => {
        if (!dot) return;
        const lane = i % shards;
        // Per-lane pace + per-dot phase offset. `x` with "106%" would be 106% of
        // the dot's own width — travel the lane's pixel width instead.
        const laneWidth = dot.parentElement?.offsetWidth ?? 0;
        tweens.push(
          gsap.fromTo(
            dot,
            { x: -8 },
            {
              x: laneWidth + 8,
              duration: 1.6 + lane * 0.22,
              repeat: -1,
              ease: "none",
              delay: (i / shards) * 0.35 + lane * 0.19,
            },
          ),
        );
      });
      return () => tweens.forEach((t) => t.kill());
    },
    { scope: containerRef, dependencies: [shards] },
  );

  // Cap rendered lanes so a 500-shard slider stays cheap; the sim handles the rest.
  const shownLanes = Math.min(shards, 6);

  return (
    <div ref={containerRef} className="relative w-full h-16 flex flex-col justify-center gap-1 px-1">
      {Array.from({ length: shownLanes }).map((_, lane) => (
        <div key={lane} className="relative h-2 rounded-full bg-neutral-700/40 overflow-hidden">
          <div className="absolute inset-0 opacity-30" style={{ background: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 10px)` }} />
          {[0, 1].map((j) => (
            <div
              key={j}
              ref={(el) => {
                dotRefs.current[lane * 2 + j] = el;
              }}
              className="absolute top-1/2 -mt-[3px] size-1.5 rounded-full"
              style={{ backgroundColor: color, left: 0 }}
            />
          ))}
        </div>
      ))}
      {shards > shownLanes && (
        <div className="text-[10px] font-mono text-neutral-500 px-1">+{shards - shownLanes} shards</div>
      )}
    </div>
  );
};

const Kinesis = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<KinesisConfig>(ServiceType.Kinesis, KINESIS_DEFAULTS, id);

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.Kinesis]}
      name="Kinesis"
      icon={serviceIcon("kinesis.svg")}
      style={style}
      visibleChildren={<ShardStreams shards={config.shards ?? KINESIS_DEFAULTS.shards} color={SERVICE_COLORS[ServiceType.Kinesis]} />}
    >
      <Slider
        label="Shards"
        min={1}
        max={500}
        step={1}
        decimals={0}
        defaultValue={KINESIS_DEFAULTS.shards}
        value={config.shards}
        onChange={(shards) => patch({ shards })}
      />
    </Node>
  );
};

export default Kinesis;
