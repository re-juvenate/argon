import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import Dropdown from "../../nodeoptions/dropdown";
import type { Option } from "../../nodeoptions/dropdown";
import { AURORA_CLASSES, AURORA_DEFAULTS, type AuroraConfig } from "#math/aurora/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

// Controls map 1:1 onto the AuroraConfig inputs of math/aurora/throughput:
// instanceClass (dropdown), maxAcu (slider, > 0 overrides the class),
// readers (slider). Selections here are the wiring point for the model.
const Aurora = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [, patch, nodeId] = useNodeConfig<AuroraConfig>(ServiceType.Aurora, AURORA_DEFAULTS, id);

  // Default class first so the Dropdown's initial display matches AURORA_DEFAULTS.
  const classNames = [
    AURORA_DEFAULTS.instanceClass,
    ...Object.keys(AURORA_CLASSES).filter((k) => k !== AURORA_DEFAULTS.instanceClass),
  ];
  const classOptions: Option[] = classNames.map((name) => ({
    name,
    onSelect: () => patch({ instanceClass: name, maxAcu: 0 }),
  }));

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.Aurora]}
      name="Aurora RDS"
      icon={serviceIcon("aurora.svg")}
      style={style}
    >
      <Dropdown label="Instance Class" options={classOptions} />
      <Slider
        label="Serverless Max ACU"
        min={0}
        max={256}
        step={1}
        decimals={0}
        defaultValue={AURORA_DEFAULTS.maxAcu}
        onChange={(maxAcu) => patch({ maxAcu })}
      />
      <Slider
        label="Readers"
        min={0}
        max={15}
        step={1}
        decimals={0}
        defaultValue={AURORA_DEFAULTS.readers}
        onChange={(readers) => patch({ readers })}
      />
    </Node>
  );
};

export default Aurora;
