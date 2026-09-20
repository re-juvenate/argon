import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, pipe, resolve, retried, CLIENT_RETRIES, startDrop, toMbps } from "../utilities";
import { ELASTICACHE_ASSUMED, ELASTICACHE_DEFAULTS, OPS_PER_NODE_S, type ElastiCacheConfig } from "./throughput";

// Ops budget exceeded: clients see latency spikes / timeouts (no SDK retries).
export const model: DropModel<ElastiCacheConfig> = {
  defaults: ELASTICACHE_DEFAULTS,

  evaluate(config) {
    const c = resolve(ELASTICACHE_DEFAULTS, config);
    return (ctx) => {
      const size = ctx.avgBytes ?? ELASTICACHE_ASSUMED.opBytes;
      const r = startDrop(ctx, toMbps(c.nodes * OPS_PER_NODE_S, size), ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Throttle, retried(r.rawDrop, CLIENT_RETRIES)),
        note(r.rawDrop.value > 0 && `ops budget ${c.nodes.toLocaleString()} × ${OPS_PER_NODE_S.toLocaleString()}/s exceeded; no retries at the cache tier`),
      );
    };
  },
};
