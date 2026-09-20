import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, pipe, start, tail } from "../utilities";
import { ELASTICACHE_DEFAULTS, type ElastiCacheConfig } from "./throughput";

// Sub-millisecond in-memory reads.
export const model: LatencyModel<ElastiCacheConfig> = {
  defaults: ELASTICACHE_DEFAULTS,

  evaluate() {
    return () =>
      pipe(
        start(ms(0.4), ModelTier.Measured),
        tail(ms(1)),
        note("in-memory: sub-millisecond reads"),
      );
  },
};
