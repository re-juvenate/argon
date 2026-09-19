import { useState, type CSSProperties } from "react";
import Node from "../../Node";
import Slider from "../../nodeoptions/slider";
import Dropdown from "../../nodeoptions/dropdown";
import type { Option } from "../../nodeoptions/dropdown";
import { AURORA_CLASSES, AURORA_DEFAULTS, type AuroraConfig } from "#math/aurora/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";
import { ServiceType } from "../../../../types/math";

// Controls map 1:1 onto the AuroraConfig inputs of math/aurora/throughput:
// instanceClass (dropdown), maxAcu (slider, > 0 overrides the class),
// readers (slider). Selections here are the wiring point for the model.
const Aurora = ({ style }: { style?: CSSProperties }) => {
  // Holds the AuroraConfig the model will consume; read it once the math is wired.
  const [, setConfig] = useState<AuroraConfig>(AURORA_DEFAULTS);

  // Default class first so the Dropdown's initial display matches AURORA_DEFAULTS.
  const classNames = [
    AURORA_DEFAULTS.instanceClass,
    ...Object.keys(AURORA_CLASSES).filter((k) => k !== AURORA_DEFAULTS.instanceClass),
  ];
  const classOptions: Option[] = classNames.map((name) => ({
    name,
    onSelect: () => setConfig((c) => ({ ...c, instanceClass: name, maxAcu: 0 })),
  }));

  return (
    <Node color={SERVICE_COLORS[ServiceType.Aurora]} name="Aurora RDS" icon={serviceIcon("aurora.svg")} style={style}>
      <Dropdown label="Instance Class" options={classOptions} />
      <Slider
        label="Serverless Max ACU"
        min={0}
        max={256}
        step={1}
        decimals={0}
        defaultValue={AURORA_DEFAULTS.maxAcu}
        onChange={(maxAcu) => setConfig((c) => ({ ...c, maxAcu }))}
      />
      <Slider
        label="Readers"
        min={0}
        max={15}
        step={1}
        decimals={0}
        defaultValue={AURORA_DEFAULTS.readers}
        onChange={(readers) => setConfig((c) => ({ ...c, readers }))}
      />
    </Node>
  );
};

export default Aurora;
