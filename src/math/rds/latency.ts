import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, mmc, offeredMbps, sizeOf, start, toRps, wait } from "../utilities";
import { RDS_ASSUMED, RDS_DEFAULTS, type RDSConfig } from "./throughput";

// M/M/c over the connection pool: μ = 1/queryMs per connection.
// Spec: reduced-formulas-latency (queueing §2.1)

export const model: LatencyModel<RDSConfig> = {
  defaults: RDS_DEFAULTS,

  evaluate(config) {
    const c = resolve(RDS_DEFAULTS, config);
    return (ctx) => {
      const lambda = toRps(offeredMbps(ctx), sizeOf(ctx, RDS_ASSUMED.queryBytes));
      const mu = 1000 / c.queryMs;
      const q = mmc(lambda, mu, c.maxConnections);
      return wait(q, c.maxConnections)(start(ms(c.queryMs), ModelTier.Estimated));
    };
  },
};
