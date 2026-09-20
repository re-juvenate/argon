import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, CLIENT_RETRIES, note, pipe, resolve, retried, sizeOf, startDrop } from "../utilities";
import { capacityFor, RDS_ASSUMED, RDS_DEFAULTS, type RDSConfig } from "./throughput";

export const model: DropModel<RDSConfig> = {
  defaults: RDS_DEFAULTS,

  evaluate(config) {
    const c = resolve(RDS_DEFAULTS, config);
    return (ctx) => {
      const r = startDrop(ctx, capacityFor(c, sizeOf(ctx, RDS_ASSUMED.queryBytes)), ModelTier.Estimated);
      return pipe(
        r,
        cause(DropKind.Refused, retried(r.rawDrop, CLIENT_RETRIES)),
        note(r.rawDrop.value > 0 && `${c.maxConnections} connections exhausted: ER_CON_COUNT_ERROR 1040 / 53300 too_many_connections; drivers do not retry`),
        note("RDS Proxy would queue the surplus instead of refusing (not modelled)"),
      );
    };
  },
};
