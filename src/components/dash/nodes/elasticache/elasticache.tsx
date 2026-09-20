import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import { ELASTICACHE_DEFAULTS, type ElastiCacheConfig } from "#math/elasticache/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

const ElastiCache = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<ElastiCacheConfig>(ServiceType.ElastiCache, ELASTICACHE_DEFAULTS, id);

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.ElastiCache]}
      name="ElastiCache"
      icon={serviceIcon("elasticache.svg")}
      style={style}
    >
      <Slider
        label="Nodes"
        min={1}
        max={40}
        step={1}
        decimals={0}
        defaultValue={ELASTICACHE_DEFAULTS.nodes}
        value={config.nodes}
        onChange={(nodes) => patch({ nodes })}
      />
      <Slider
        label="Node Memory (GB)"
        min={1}
        max={64}
        step={1}
        decimals={0}
        defaultValue={ELASTICACHE_DEFAULTS.memoryGb}
        value={config.memoryGb}
        onChange={(memoryGb) => patch({ memoryGb })}
      />
    </Node>
  );
};

export default ElastiCache;
