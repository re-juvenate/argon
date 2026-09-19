import type { CSSProperties } from "react";
import Node from "../../Node";
import { graphStore, useNodeConfig } from "#graph";
import { outputsOf } from "#graph/graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import Boolean from "../../nodeoptions/boolean";
import { ROUTE53_DEFAULTS, type Route53Config } from "#math/route53/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

const Route53 = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<Route53Config>(ServiceType.Route53, ROUTE53_DEFAULTS, id);

  const fill = <T,>(value: T): T[] => Array.from({ length: Math.max(1, outputsOf(graphStore.get(), nodeId).length) }, () => value);
  const applyWeight = (w: number) => patch({ weights: fill(w) });
  const applyHealthy = (h: boolean) => patch({ healthy: fill(h) });

  return (
    <Node id={nodeId} color={SERVICE_COLORS[ServiceType.Route53]} name="Route 53" icon={serviceIcon("route53.svg")} style={style}>
      <Slider
        label="Record Weight"
        min={0}
        max={255}
        step={1}
        decimals={0}
        defaultValue={1}
        value={config.weights?.[0]}
        onChange={applyWeight}
      />
      <Boolean label="Record Healthy" defaultChecked={true} checked={config.healthy?.[0]} onChange={applyHealthy} />
      <Slider
        label="Health Check Interval (s)"
        min={10}
        max={30}
        step={20}
        decimals={0}
        defaultValue={ROUTE53_DEFAULTS.intervalS}
        value={config.intervalS}
        onChange={(intervalS) => patch({ intervalS })}
      />
      <Slider
        label="Failure Threshold"
        min={1}
        max={10}
        step={1}
        decimals={0}
        defaultValue={ROUTE53_DEFAULTS.failureThreshold}
        value={config.failureThreshold}
        onChange={(failureThreshold) => patch({ failureThreshold })}
      />
      <Slider
        label="TTL (s)"
        min={0}
        max={3600}
        step={30}
        decimals={0}
        defaultValue={ROUTE53_DEFAULTS.ttlS}
        value={config.ttlS}
        onChange={(ttlS) => patch({ ttlS })}
      />
    </Node>
  );
};

export default Route53;
