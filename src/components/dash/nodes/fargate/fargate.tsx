import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import { FARGATE_DEFAULTS, type FargateConfig } from "#math/ecs/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

// Controls map onto the FargateConfig inputs of math/ecs/throughput:
// vcpu, memGiB, tasks (sliders).
const Fargate = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [, patch, nodeId] = useNodeConfig<FargateConfig>(ServiceType.ECS, FARGATE_DEFAULTS, id);

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.ECS]}
      name="Fargate"
      icon={serviceIcon("fargate.svg")}
      style={style}
    >
      <Slider
        label="Task vCPU"
        min={0.25}
        max={16}
        step={0.25}
        decimals={2}
        defaultValue={FARGATE_DEFAULTS.vcpu}
        onChange={(vcpu) => patch({ vcpu })}
      />
      <Slider
        label="Task Memory (GiB)"
        min={0.5}
        max={120}
        step={0.5}
        decimals={1}
        defaultValue={FARGATE_DEFAULTS.memGiB}
        onChange={(memGiB) => patch({ memGiB })}
      />
      <Slider
        label="Tasks"
        min={1}
        max={200}
        step={1}
        decimals={0}
        defaultValue={FARGATE_DEFAULTS.tasks}
        onChange={(tasks) => patch({ tasks })}
      />
    </Node>
  );
};

export default Fargate;
