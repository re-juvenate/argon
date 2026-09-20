import { ModelTier, type ServiceModel } from "../../types/math";
import { bytes, cap, KiB, offered, pipe, resolve, sizeOf, toMbps } from "../utilities";

export interface ElastiCacheConfig {
  nodes?: number;
  memoryGb?: number;
}

export const ELASTICACHE_DEFAULTS: Required<ElastiCacheConfig> = {
  nodes: 1,
  // cache.r6g.large usable memory
  memoryGb: 13,
};

// Measured ~100k simple ops/s per node (redis-benchmark, GET/SET).
export const OPS_PER_NODE_S = 100_000;

// Assumed payload per op when edges carry no size.
export const ELASTICACHE_ASSUMED = { opBytes: bytes(KiB) } as const;

export const model: ServiceModel<ElastiCacheConfig> = {
  defaults: ELASTICACHE_DEFAULTS,

  capacity(config) {
    const c = resolve(ELASTICACHE_DEFAULTS, config);
    return toMbps(c.nodes * OPS_PER_NODE_S, ELASTICACHE_ASSUMED.opBytes);
  },

  evaluate(config) {
    const c = resolve(ELASTICACHE_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, ELASTICACHE_ASSUMED.opBytes);
      return pipe(offered(ctx, ModelTier.Measured), cap(toMbps(c.nodes * OPS_PER_NODE_S, size)));
    };
  },
};
