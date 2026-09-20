import { ModelTier, type Bytes, type Mbps, type ServiceModel } from "../../types/math";
import { bytes, cap, gbpsToMbps, KiB, mbps, note, offered, pipe, resolve, sizeOf, splitEven, toMbps } from "../utilities";

export interface ElastiCacheConfig {
  nodes?: number;
  nodeType?: string;
  memoryGb?: number;
}

export const ELASTICACHE_DEFAULTS: Required<ElastiCacheConfig> = {
  nodes: 1,
  nodeType: "cache.r6g.large",
  memoryGb: 13,
};

export interface CacheNodeSpec {
  opsPerSec: number;
  networkMbps: Mbps;
  maxClients: number;
  memoryGb: number;
  measured: boolean;
}

export const CACHE_NODE_SPECS: Record<string, CacheNodeSpec> = {
  "cache.t4g.medium": { opsPerSec: 90_000, networkMbps: gbpsToMbps(5), maxClients: 65_000, memoryGb: 3.09, measured: false },
  "cache.r6g.large": { opsPerSec: 200_000, networkMbps: gbpsToMbps(10), maxClients: 65_000, memoryGb: 13.07, measured: false },
  "cache.r6g.xlarge": { opsPerSec: 349_239, networkMbps: gbpsToMbps(10), maxClients: 65_000, memoryGb: 26.32, measured: true },
  "cache.r6g.2xlarge": { opsPerSec: 500_000, networkMbps: gbpsToMbps(10), maxClients: 65_000, memoryGb: 52.82, measured: false },
  "cache.r7g.4xlarge": { opsPerSec: 1_000_000, networkMbps: gbpsToMbps(15), maxClients: 65_000, memoryGb: 105.81, measured: true },
};

export const ELASTICACHE_ASSUMED = { opBytes: bytes(KiB) } as const;

export const resolveCacheSpec = (nodeType: string = ELASTICACHE_DEFAULTS.nodeType): CacheNodeSpec =>
  CACHE_NODE_SPECS[nodeType] ?? CACHE_NODE_SPECS[ELASTICACHE_DEFAULTS.nodeType];

export function capacityFor(c: Required<ElastiCacheConfig>, size: Bytes): { capacity: Mbps; nicBound: boolean } {
  const spec = resolveCacheSpec(c.nodeType);
  const ops = toMbps(c.nodes * spec.opsPerSec, size);
  const nic = mbps(c.nodes * spec.networkMbps.value);
  return { capacity: mbps(Math.min(ops.value, nic.value)), nicBound: nic.value < ops.value };
}

export const model: ServiceModel<ElastiCacheConfig> = {
  defaults: ELASTICACHE_DEFAULTS,

  capacity(config) {
    return capacityFor(resolve(ELASTICACHE_DEFAULTS, config), ELASTICACHE_ASSUMED.opBytes).capacity;
  },

  evaluate(config) {
    const c = resolve(ELASTICACHE_DEFAULTS, config);
    const spec = resolveCacheSpec(c.nodeType);
    return (ctx) => {
      const size = sizeOf(ctx, ELASTICACHE_ASSUMED.opBytes);
      const { capacity, nicBound } = capacityFor(c, size);
      return pipe(
        offered(ctx, spec.measured ? ModelTier.Measured : ModelTier.Estimated),
        cap(capacity),
        splitEven(ctx.outputCount),
        note(`${c.nodes} × ${c.nodeType}: ${(c.nodes * spec.opsPerSec).toLocaleString()} ops/s${spec.measured ? "" : " (scaled from r6g.xlarge benchmark)"}`),
        note(nicBound && `NIC-bound: ${size.value / KiB} KiB ops saturate ${spec.networkMbps.value.toLocaleString()} Mbps per node first`),
        note(!CACHE_NODE_SPECS[c.nodeType] && `unknown node type, using ${ELASTICACHE_DEFAULTS.nodeType}`),
      );
    };
  },
};
