import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import { SNS_DEFAULTS, type SNSConfig } from "#math/sns/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

// Fanout viz: messages leave the topic hub and travel along a curve to each
// subscriber. Dots advance via path.getPointAtLength — no MotionPathPlugin.
const PubSubFanout = ({ subscribers, color }: { subscribers: number; color: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);

  useGSAP(
    () => {
      const tweens: gsap.core.Tween[] = [];
      pathRefs.current.forEach((path, i) => {
        if (!path) return;
        const len = path.getTotalLength();
        // Two messages per subscriber, phase-offset so the stream is continuous.
        [0, 0.5].forEach((phase, j) => {
          const dot = dotRefs.current[i * 2 + j];
          if (!dot) return;
          const progress = { t: 0 };
          tweens.push(
            gsap.to(progress, {
              t: 1,
              duration: 1.4,
              repeat: -1,
              ease: "none",
              delay: phase + i * 0.12,
              onUpdate: () => {
                const point = path.getPointAtLength(progress.t * len);
                dot.setAttribute("cx", String(point.x));
                dot.setAttribute("cy", String(point.y));
                dot.setAttribute("opacity", progress.t < 0.06 || progress.t > 0.94 ? "0" : "1");
              },
            }),
          );
        });
      });
      return () => tweens.forEach((t) => t.kill());
    },
    { scope: containerRef, dependencies: [subscribers] },
  );

  const laneY = (i: number) => 32 + (i - (subscribers - 1) / 2) * Math.min(14, 48 / Math.max(subscribers, 1));

  return (
    <div ref={containerRef} className="relative w-full h-16">
      <svg viewBox="0 0 200 64" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        {Array.from({ length: subscribers }).map((_, i) => {
          const y = laneY(i);
          return (
            <g key={i}>
              <path
                ref={(el) => {
                  pathRefs.current[i] = el;
                }}
                d={`M 26 32 C 90 32, 120 ${y}, 182 ${y}`}
                fill="none"
                stroke={color}
                strokeOpacity={0.35}
                strokeWidth={1.5}
              />
              {/* subscriber */}
              <rect x={182} y={y - 4} width={8} height={8} rx={1.5} fill={color} opacity={0.75} />
              {[
                0,
                0.5,
              ].map((_, j) => (
                <circle
                  key={j}
                  ref={(el) => {
                    dotRefs.current[i * 2 + j] = el;
                  }}
                  r={2.5}
                  fill={color}
                  opacity={0}
                />
              ))}
            </g>
          );
        })}
        {/* topic hub */}
        <circle cx={20} cy={32} r={6} fill={color} />
        <circle cx={20} cy={32} r={10} fill="none" stroke={color} strokeOpacity={0.4} strokeDasharray="3 3" />
      </svg>
    </div>
  );
};

const SNS = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<SNSConfig>(ServiceType.SNS, SNS_DEFAULTS, id);

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.SNS]}
      name="SNS"
      icon={serviceIcon("sns.svg")}
      style={style}
      visibleChildren={<PubSubFanout subscribers={config.subscribers} color={SERVICE_COLORS[ServiceType.SNS]} />}
    >
      <Slider
        label="Subscribers"
        min={1}
        max={10}
        step={1}
        decimals={0}
        defaultValue={SNS_DEFAULTS.subscribers}
        value={config.subscribers}
        onChange={(subscribers) => patch({ subscribers })}
      />
    </Node>
  );
};

export default SNS;
