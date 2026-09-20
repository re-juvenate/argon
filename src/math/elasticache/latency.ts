import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, offeredMbps, pipe, resolve, sizeOf, start, tail } from "../utilities";
import { capacityFor, ELASTICACHE_ASSUMED, ELASTICACHE_DEFAULTS, type ElastiCacheConfig } from "./throughput";

export const ELASTICACHE_LATENCY = {
  p50Ms: ms(0.44),
  p99Ms: ms(2.45),
  measuredAtUtilization: 0.7,
} as const;

export const model: LatencyModel<ElastiCacheConfig> = {
  defaults: ELASTICACHE_DEFAULTS,

  evaluate(config) {
    const c = resolve(ELASTICACHE_DEFAULTS, config);
    return (ctx) => {
      const { capacity } = capacityFor(c, sizeOf(ctx, ELASTICACHE_ASSUMED.opBytes));
      const rho = capacity.value > 0 ? offeredMbps(ctx).value / capacity.value : 0;
      const tailScale = Math.max(1, rho / ELASTICACHE_LATENCY.measuredAtUtilization);
      return pipe(
        start(ELASTICACHE_LATENCY.p50Ms, ModelTier.Measured),
        (r) => ({ ...r, utilization: rho }),
        tail(ms(ELASTICACHE_LATENCY.p99Ms.value * tailScale)),
        note("Redis 7 on r6g.xlarge: 0.44 ms p50 / 2.45 ms p99 at 70% utilization (AWS benchmark)"),
        note(tailScale > 1 && `tail scaled ×${tailScale.toFixed(2)} above the measured 70% utilization`),
      );
    };
  },
};
