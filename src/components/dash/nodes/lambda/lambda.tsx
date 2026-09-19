import { useState, type CSSProperties } from "react";
import Node from "../../Node";
import Slider from "../../nodeoptions/slider";
import { LAMBDA_DEFAULTS, type LambdaConfig } from "#math/lambda/throughput";

// Controls map onto the LambdaConfig inputs of math/lambda/throughput:
// memoryMb, reservedConcurrency, regionConcurrency (sliders). Region is not
// user-settable here; it is inferred from the parent.
const Lambda = ({ style }: { style?: CSSProperties }) => {
  const [, setConfig] = useState<LambdaConfig>(LAMBDA_DEFAULTS);

  return (
    <Node color="#d86613" name="Lambda" style={style}>
      <Slider
        label="Memory (MB)"
        min={128}
        max={10240}
        step={64}
        decimals={0}
        defaultValue={LAMBDA_DEFAULTS.memoryMb}
        onChange={(memoryMb) => setConfig((c) => ({ ...c, memoryMb }))}
      />
      <Slider
        label="Reserved Concurrency"
        min={0}
        max={1000}
        step={1}
        decimals={0}
        defaultValue={LAMBDA_DEFAULTS.reservedConcurrency}
        onChange={(reservedConcurrency) => setConfig((c) => ({ ...c, reservedConcurrency }))}
      />
      <Slider
        label="Region Concurrency"
        min={100}
        max={10000}
        step={100}
        decimals={0}
        defaultValue={LAMBDA_DEFAULTS.regionConcurrency}
        onChange={(regionConcurrency) => setConfig((c) => ({ ...c, regionConcurrency }))}
      />
    </Node>
  );
};

export default Lambda;
