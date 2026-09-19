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
  const [config, patch, nodeId] = useNodeConfig<FargateConfig>(ServiceType.ECS, FARGATE_DEFAULTS, id);

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
        value={config.vcpu}
        onChange={(vcpu) => patch({ vcpu })}
      />
      <Slider
        label="Task Memory (GiB)"
        min={0.5}
        max={120}
        step={0.5}
        decimals={1}
        defaultValue={FARGATE_DEFAULTS.memGiB}
        value={config.memGiB}
        onChange={(memGiB) => patch({ memGiB })}
      />
      <Slider
        label="Tasks"
        min={1}
        max={200}
        step={1}
        decimals={0}
        defaultValue={FARGATE_DEFAULTS.tasks}
        value={config.tasks}
        onChange={(tasks) => patch({ tasks })}
      />
      <Slider
        label="Min Tasks (0 = fixed)"
        min={0}
        max={200}
        step={1}
        decimals={0}
        defaultValue={FARGATE_DEFAULTS.minTasks}
        value={config.minTasks}
        onChange={(minTasks) => patch({ minTasks })}
      />
      <Slider
        label="Max Tasks (0 = fixed)"
        min={0}
        max={500}
        step={1}
        decimals={0}
        defaultValue={FARGATE_DEFAULTS.maxTasks}
        value={config.maxTasks}
        onChange={(maxTasks) => patch({ maxTasks })}
      />
      <Slider
        label="Target Utilization"
        min={0.1}
        max={1}
        step={0.05}
        decimals={2}
        defaultValue={FARGATE_DEFAULTS.targetUtilization}
        value={config.targetUtilization}
        onChange={(targetUtilization) => patch({ targetUtilization })}
      />
    </Node>
  );
};

export default Fargate;
