import { ModelTier, type LatencyModel } from "../../types/math";
import { mmc, ms, note, offeredMbps, pipe, resolve, sizeOf, start, toRps, wait } from "../utilities";
import { connectionRate, RDS_ASSUMED, RDS_DEFAULTS, type RDSConfig } from "./throughput";

export const model: LatencyModel<RDSConfig> = {
  defaults: RDS_DEFAULTS,

  evaluate(config) {
    const c = resolve(RDS_DEFAULTS, config);
    return (ctx) => {
      const lambda = toRps(offeredMbps(ctx), sizeOf(ctx, RDS_ASSUMED.queryBytes));
      const q = mmc(lambda, connectionRate(c), c.maxConnections);
      return pipe(
        start(ms(c.queryMs), ModelTier.Estimated),
        wait(q, c.maxConnections),
        note(`M/M/${c.maxConnections}: one query per connection, ${c.queryMs} ms service`),
      );
    };
  },
};
