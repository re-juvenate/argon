import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Dropdown from "../../nodeoptions/dropdown";
import Slider from "../../nodeoptions/slider";
import { CACHE_NODE_SPECS, ELASTICACHE_DEFAULTS, type ElastiCacheConfig } from "#math/elasticache/throughput";
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
      <Dropdown
        label="Node Type"
        options={Object.keys(CACHE_NODE_SPECS).map((name) => ({ name, onSelect: () => patch({ nodeType: name }) }))}
        value={config.nodeType}
      />
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
