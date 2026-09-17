import { ModelTier, type ServiceModel } from "../../types/math";
import { bytes, cap, KiB, mbps, note, offered, pipe, resolve, splitEven, toMbps } from "../utilities";
import { S3StorageTier } from "./cost";

// S3. At setup you choose the storage class. Request rate is AWS's per-prefix quota
// (3,500 write / 5,500 read per second); S3 has no byte cap of its own.
// Spec: .references/reduced-formulas-throughput.md §3.7

export interface S3Config {
  tier?: S3StorageTier;
}

export const S3_DEFAULTS: Required<S3Config> = { tier: S3StorageTier.STANDARD };

export const S3_FIXED = { writeRpsPerPrefix: 3500, readRpsPerPrefix: 5500 } as const;

export const S3_ASSUMED = {
  prefixes: 1,
  readFraction: 0.8,
  objectBytes: bytes(256 * KiB),
} as const;

// Glacier Flexible / Deep Archive are restore-then-read; no synchronous throughput.
const ARCHIVE_TIERS: ReadonlySet<S3StorageTier> = new Set([S3StorageTier.GLACIER_FLEXIBLE, S3StorageTier.DEEP_ARCHIVE]);

export function requestsPerSecond(): number {
  const a = S3_ASSUMED;
  return a.prefixes * (a.readFraction * S3_FIXED.readRpsPerPrefix + (1 - a.readFraction) * S3_FIXED.writeRpsPerPrefix);
}

export const model: ServiceModel<S3Config> = {
  defaults: S3_DEFAULTS,

  capacity(config) {
    const c = resolve(S3_DEFAULTS, config);
    return ARCHIVE_TIERS.has(c.tier) ? mbps(0) : toMbps(requestsPerSecond(), S3_ASSUMED.objectBytes);
  },

  evaluate(config) {
    const c = resolve(S3_DEFAULTS, config);
    const capacity = model.capacity(c);
    return (ctx) =>
      pipe(
        offered(ctx, ModelTier.Measured),
        cap(capacity),
        splitEven(ctx.outputCount),
        note("request-rate bound per prefix; bytes bounded by caller NIC"),
        note(ARCHIVE_TIERS.has(c.tier) && "archive tier: no synchronous reads"),
      );
  },
};
