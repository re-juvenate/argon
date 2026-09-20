import { ModelTier, type ServiceModel } from "../../types/math";
import { bytes, KiB, cap, offered, pipe, resolve, sizeOf, toMbps } from "../utilities";

export interface RDSConfig {
  maxConnections?: number;
  queryMs?: number;
}

export const RDS_DEFAULTS: Required<RDSConfig> = {
  // db.t3.micro-class default max_connections
  maxConnections: 100,
  queryMs: 5,
};

// Assumed payload per query round-trip when edges carry no size.
export const RDS_ASSUMED = { queryBytes: bytes(4 * KiB) } as const;

const rps = (c: Required<RDSConfig>, queryBytes: number) =>
  c.maxConnections * (1000 / c.queryMs) * (RDS_ASSUMED.queryBytes.value / queryBytes);

export const model: ServiceModel<RDSConfig> = {
  defaults: RDS_DEFAULTS,

  capacity(config) {
    return toMbps(rps(resolve(RDS_DEFAULTS, config), RDS_ASSUMED.queryBytes.value), RDS_ASSUMED.queryBytes);
  },

  evaluate(config) {
    const c = resolve(RDS_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, RDS_ASSUMED.queryBytes);
      return pipe(offered(ctx, ModelTier.Estimated), cap(toMbps(rps(c, size.value), size)));
    };
  },
};
