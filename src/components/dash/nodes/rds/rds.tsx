import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import { RDS_DEFAULTS, type RDSConfig } from "#math/rds/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

const RDS = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<RDSConfig>(ServiceType.RDS, RDS_DEFAULTS, id);

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.RDS]}
      name="RDS"
      icon={serviceIcon("rds.svg")}
      style={style}
    >
      <Slider
        label="Max Connections"
        min={10}
        max={16000}
        step={10}
        decimals={0}
        defaultValue={RDS_DEFAULTS.maxConnections}
        value={config.maxConnections}
        onChange={(maxConnections) => patch({ maxConnections })}
      />
      <Slider
        label="Query Time (ms)"
        min={0.1}
        max={100}
        step={0.1}
        decimals={1}
        defaultValue={RDS_DEFAULTS.queryMs}
        value={config.queryMs}
        onChange={(queryMs) => patch({ queryMs })}
      />
    </Node>
  );
};

export default RDS;
