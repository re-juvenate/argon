import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Dropdown from "../../nodeoptions/dropdown";
import Slider from "../../nodeoptions/slider";
import type { Option } from "../../nodeoptions/dropdown";
import { LB_DEFAULTS, LBKind, type LBConfig } from "#math/lb/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

// Controls map onto the LBConfig inputs of math/lb/throughput:
// kind (dropdown) and reservedLcu (slider, 0 = no reservation).
const ELB = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<LBConfig>(ServiceType.LB, LB_DEFAULTS, id);

  const kindOptions: Option[] = [
    { name: "ALB", onSelect: () => patch({ kind: LBKind.ALB }) },
    { name: "NLB", onSelect: () => patch({ kind: LBKind.NLB }) },
  ];

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.LB]}
      name="ELB"
      icon={serviceIcon("elb.svg")}
      style={style}
    >
      <Dropdown label="Balancer Kind" options={kindOptions} value={config.kind === LBKind.NLB ? "NLB" : "ALB"} />
      <Slider
        label="Reserved LCU"
        min={0}
        max={1000}
        step={1}
        decimals={0}
        defaultValue={LB_DEFAULTS.reservedLcu}
        value={config.reservedLcu}
        onChange={(reservedLcu) => patch({ reservedLcu })}
      />
    </Node>
  );
};

export default ELB;
