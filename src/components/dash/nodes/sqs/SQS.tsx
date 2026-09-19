import { useGSAP } from "@gsap/react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Dropdown from "../../nodeoptions/dropdown";
import Boolean from "../../nodeoptions/boolean";
import type { Option } from "../../nodeoptions/dropdown";
import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { QueueType, SQS_DEFAULTS, type SQSConfig } from "#math/sqs/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

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
        ease: "none",
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

// Controls map onto the SQSConfig inputs of math/sqs/throughput:
// queueType (dropdown) and highThroughput (boolean, FIFO only). Region is not
// user-settable here; it is inferred from the parent.
const SQS = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<SQSConfig>(ServiceType.SQS, SQS_DEFAULTS, id);

  const queueOptions: Option[] = [
    {
      name: "Standard",
      onSelect: () => patch({ queueType: QueueType.Standard }),
    },
    {
      name: "FIFO",
      onSelect: () => patch({ queueType: QueueType.FIFO }),
    },
  ];

  return (
    <Node id={nodeId}
      style={style}
      color={SERVICE_COLORS[ServiceType.SQS]}
      icon={serviceIcon("sqs.svg")}
      name="SQS"
      visibleChildren={<Queue n={10} speed={2} state={true} />}
    >
      <Dropdown label="Queue Type" options={queueOptions} />
      {config.queueType === QueueType.FIFO && (
        <Boolean
          label="High Throughput"
          defaultChecked={SQS_DEFAULTS.highThroughput}
          onChange={(highThroughput) => patch({ highThroughput })}
        />
      )}
    </Node>
  );
};

export default SQS;
