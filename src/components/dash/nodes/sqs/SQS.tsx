import { useGSAP } from "@gsap/react";
import Node from "../../Node";
import Dropdown from "../../nodeoptions/dropdown";
import Boolean from "../../nodeoptions/boolean";
import type { Option } from "../../nodeoptions/dropdown";
import { useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { QueueType, SQS_DEFAULTS, type SQSConfig } from "#math/sqs/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";
import { ServiceType } from "../../../../types/math";

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
const SQS = ({ style }: { style?: CSSProperties }) => {
  const [queueType, setQueueType] = useState(QueueType.Standard);
  const [, setConfig] = useState<SQSConfig>(SQS_DEFAULTS);

  const queueOptions: Option[] = [
    {
      name: "Standard",
      onSelect: () => {
        setQueueType(QueueType.Standard);
        setConfig((c) => ({ ...c, queueType: QueueType.Standard }));
      },
    },
    {
      name: "FIFO",
      onSelect: () => {
        setQueueType(QueueType.FIFO);
        setConfig((c) => ({ ...c, queueType: QueueType.FIFO }));
      },
    },
  ];

  return (
    <Node
      style={style}
      color={SERVICE_COLORS[ServiceType.SQS]}
      icon={serviceIcon("sqs.svg")}
      name="SQS"
      visibleChildren={<Queue n={10} speed={2} state={true} />}
    >
      <Dropdown label="Queue Type" options={queueOptions} />
      {queueType === QueueType.FIFO && (
        <Boolean
          label="High Throughput"
          defaultChecked={SQS_DEFAULTS.highThroughput}
          onChange={(highThroughput) => setConfig((c) => ({ ...c, highThroughput }))}
        />
      )}
    </Node>
  );
};

export default SQS;
