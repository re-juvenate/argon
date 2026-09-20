import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, mbps, note, pipe, resolve, retried, SDK_RETRIES, startDrop } from "../utilities";
import { RDS_ASSUMED, RDS_DEFAULTS, type RDSConfig } from "./throughput";

// Connections exhausted → "too many connections already" (SDK-retried).
export const model: DropModel<RDSConfig> = {
  defaults: RDS_DEFAULTS,

  evaluate(config) {
    const c = resolve(RDS_DEFAULTS, config);
    return (ctx) => {
      const rps = c.maxConnections * (1000 / c.queryMs);
      const capacity = mbps((rps * RDS_ASSUMED.queryBytes.value * 8) / 1e6);
      const r = startDrop(ctx, capacity, ModelTier.Estimated);
      return pipe(
        r,
        cause(DropKind.Throttle, retried(r.rawDrop, SDK_RETRIES)),
        note(r.rawDrop.value > 0 && `connection pool exhausted: FATAL 53300 too_many_connections before ${SDK_RETRIES} SDK retries`),
      );
    };
  },
};
