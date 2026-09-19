import { useState, type CSSProperties } from "react";
import Node from "../../Node";
import Slider from "../../nodeoptions/slider";
import { FARGATE_DEFAULTS, type FargateConfig } from "#math/ecs/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";
import { ServiceType } from "../../../../types/math";

// Controls map onto the FargateConfig inputs of math/ecs/throughput:
// vcpu, memGiB, tasks (sliders).
const Fargate = ({ style }: { style?: CSSProperties }) => {
  const [, setConfig] = useState<FargateConfig>(FARGATE_DEFAULTS);

  return (
    <Node color={SERVICE_COLORS[ServiceType.ECS]} name="Fargate" icon={serviceIcon("fargate.svg")} style={style}>
      <Slider
        label="Task vCPU"
        min={0.25}
        max={16}
        step={0.25}
        decimals={2}
        defaultValue={FARGATE_DEFAULTS.vcpu}
        onChange={(vcpu) => setConfig((c) => ({ ...c, vcpu }))}
      />
      <Slider
        label="Task Memory (GiB)"
        min={0.5}
        max={120}
        step={0.5}
        decimals={1}
        defaultValue={FARGATE_DEFAULTS.memGiB}
        onChange={(memGiB) => setConfig((c) => ({ ...c, memGiB }))}
      />
      <Slider
        label="Tasks"
        min={1}
        max={200}
        step={1}
        decimals={0}
        defaultValue={FARGATE_DEFAULTS.tasks}
        onChange={(tasks) => setConfig((c) => ({ ...c, tasks }))}
      />
    </Node>
  );
};

export default Fargate;
