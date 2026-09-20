import { ModelTier, type Bytes, type Mbps, type ServiceModel } from "../../types/math";
import { bytes, cap, KiB, note, offered, pipe, resolve, sizeOf, splitEven, toMbps } from "../utilities";

export interface RDSConfig {
  maxConnections?: number;
  queryMs?: number;
}

export const RDS_DEFAULTS: Required<RDSConfig> = {
  maxConnections: 100,
  queryMs: 5,
};

export const RDS_FIXED = {
  mysqlBytesPerConnection: 12_582_880,
  postgresBytesPerConnection: 9_531_392,
  postgresMaxConnections: 5000,
} as const;

export const RDS_ASSUMED = { queryBytes: bytes(4 * KiB) } as const;

export const connectionRate = (c: Required<RDSConfig>): number => 1000 / c.queryMs;
export const poolRps = (c: Required<RDSConfig>): number => c.maxConnections * connectionRate(c);
export const capacityFor = (c: Required<RDSConfig>, size: Bytes): Mbps => toMbps(poolRps(c), size);

export const model: ServiceModel<RDSConfig> = {
  defaults: RDS_DEFAULTS,

  capacity(config) {
    return capacityFor(resolve(RDS_DEFAULTS, config), RDS_ASSUMED.queryBytes);
  },

  evaluate(config) {
    const c = resolve(RDS_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, RDS_ASSUMED.queryBytes);
      return pipe(
        offered(ctx, ModelTier.Estimated),
        cap(capacityFor(c, size)),
        splitEven(ctx.outputCount),
        note(`${c.maxConnections} connections × ${connectionRate(c).toFixed(0)} queries/s = ${poolRps(c).toLocaleString()} rps (queryMs assumed)`),
      );
    };
  },
};
