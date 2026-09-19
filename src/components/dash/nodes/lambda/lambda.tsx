import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import { LAMBDA_DEFAULTS, type LambdaConfig } from "#math/lambda/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

// Controls map onto the LambdaConfig inputs of math/lambda/throughput:
// memoryMb, reservedConcurrency, regionConcurrency (sliders). Region is not
// user-settable here; it is inferred from the parent.
const Lambda = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<LambdaConfig>(ServiceType.Lambda, LAMBDA_DEFAULTS, id);

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.Lambda]}
      name="Lambda"
      icon={serviceIcon("lambda.svg")}
      style={style}
    >
      <Slider
        label="Memory (MB)"
        min={128}
        max={10240}
        step={64}
        decimals={0}
        defaultValue={LAMBDA_DEFAULTS.memoryMb}
        value={config.memoryMb}
        onChange={(memoryMb) => patch({ memoryMb })}
      />
      <Slider
        label="Reserved Concurrency"
        min={0}
        max={1000}
        step={1}
        decimals={0}
        defaultValue={LAMBDA_DEFAULTS.reservedConcurrency}
        value={config.reservedConcurrency}
        onChange={(reservedConcurrency) => patch({ reservedConcurrency })}
      />
      <Slider
        label="Region Concurrency"
        min={100}
        max={10000}
        step={100}
        decimals={0}
        defaultValue={LAMBDA_DEFAULTS.regionConcurrency}
        value={config.regionConcurrency}
        onChange={(regionConcurrency) => patch({ regionConcurrency })}
      />
    </Node>
  );
};

export default Lambda;
