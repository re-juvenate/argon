import { useState, type CSSProperties } from "react";
import Node from "../../Node";
import Dropdown from "../../nodeoptions/dropdown";
import Slider from "../../nodeoptions/slider";
import type { Option } from "../../nodeoptions/dropdown";
import { LB_DEFAULTS, LBKind, type LBConfig } from "#math/lb/throughput";

// Controls map onto the LBConfig inputs of math/lb/throughput:
// kind (dropdown) and reservedLcu (slider, 0 = no reservation).
const ELB = ({ style }: { style?: CSSProperties }) => {
  const [, setConfig] = useState<LBConfig>(LB_DEFAULTS);

  const kindOptions: Option[] = [
    { name: "ALB", onSelect: () => setConfig((c) => ({ ...c, kind: LBKind.ALB })) },
    { name: "NLB", onSelect: () => setConfig((c) => ({ ...c, kind: LBKind.NLB })) },
  ];

  return (
    <Node color="#693cc5" name="ELB" style={style}>
      <Dropdown label="Balancer Kind" options={kindOptions} />
      <Slider
        label="Reserved LCU"
        min={0}
        max={1000}
        step={1}
        decimals={0}
        defaultValue={LB_DEFAULTS.reservedLcu}
        onChange={(reservedLcu) => setConfig((c) => ({ ...c, reservedLcu }))}
      />
    </Node>
  );
};

export default ELB;
