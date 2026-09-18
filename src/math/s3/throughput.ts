import { ModelTier, type RampState, type ServiceModel, type ThroughputContext } from "../../types/math";
import { bytes, cap, current, KiB, mbps, newRampState, note, offered, offeredMbps, pipe, ramp, resolve, sizeOf, splitEven, toMbps, toRps, type RampSpec } from "../utilities";
import { GlacierRetrievalSpeed, S3StorageTier } from "./cost";

// S3. At setup you choose the storage class. Request rate is AWS's per-prefix quota
// (3,500 write / 5,500 read per second), which S3 raises gradually under sustained load
// (partition split, 503 SlowDown meanwhile); Express One Zone directory buckets start at
// 100,000 write / 200,000 read. S3 has no byte cap of its own.
// Spec: .references/reduced-formulas-throughput.md §3.7, reduced-formulas-drop.md §6

export interface S3Config {
  tier?: S3StorageTier;
  // archive tiers only
  retrieval?: GlacierRetrievalSpeed;
}

export const S3_DEFAULTS: Required<S3Config> = { tier: S3StorageTier.STANDARD, retrieval: GlacierRetrievalSpeed.STANDARD };

export const S3_FIXED = {
  writeRpsPerPrefix: 3500,
  readRpsPerPrefix: 5500,
  // Express One Zone directory bucket defaults (raisable)
  expressWriteRps: 100_000,
  expressReadRps: 200_000,
} as const;

export const S3_ASSUMED = {
  prefixes: 1,
  readFraction: 0.8,
  objectBytes: bytes(256 * KiB),
  // partition scaling: first-order lag toward sustained demand (docs: "gradual", unpublished)
  rampTauS: 300,
} as const;

// Glacier Flexible / Deep Archive are restore-then-read; no synchronous throughput.
export const ARCHIVE_TIERS: ReadonlySet<S3StorageTier> = new Set([S3StorageTier.GLACIER_FLEXIBLE, S3StorageTier.DEEP_ARCHIVE]);

// current request capacity (rps) after partition scaling
export type S3State = RampState;

// quota the bucket starts at
export function baseRps(tier: S3StorageTier): number {
  const a = S3_ASSUMED;
  if (ARCHIVE_TIERS.has(tier)) return 0;
  if (tier === S3StorageTier.EXPRESS_ONE_ZONE) return a.readFraction * S3_FIXED.expressReadRps + (1 - a.readFraction) * S3_FIXED.expressWriteRps;
  return a.prefixes * (a.readFraction * S3_FIXED.readRpsPerPrefix + (1 - a.readFraction) * S3_FIXED.writeRpsPerPrefix);
}

export const requestsPerSecond = (config?: S3Config): number => baseRps(resolve(S3_DEFAULTS, config).tier);

// general-purpose buckets repartition under sustained load; Express and archive tiers do not
export function partitionRamp(tier: S3StorageTier): RampSpec | undefined {
  if (tier === S3StorageTier.EXPRESS_ONE_ZONE || ARCHIVE_TIERS.has(tier)) return undefined;
  const floor = baseRps(tier);
  return { floor, ceiling: Infinity, rateUp: Infinity, rateDown: Infinity, tauS: S3_ASSUMED.rampTauS, delayUpS: 0, delayDownS: 0, launchS: 0, cooldownS: 0 };
}

// rps capacity this tick. With `demandRps` (throughput pass) the ramp advances; without it
// (latency / drop) the current level is read.
export function capacityRps(config: Required<S3Config>, state: S3State | undefined, ctx: ThroughputContext, demandRps?: number): number {
  const spec = partitionRamp(config.tier);
  if (spec === undefined || state === undefined) return baseRps(config.tier);
  if (demandRps !== undefined) return ramp(state, Math.max(spec.floor, demandRps), spec, ctx);
  return current(state, ctx)?.level ?? baseRps(config.tier);
}

export const model: ServiceModel<S3Config, S3State> = {
  defaults: S3_DEFAULTS,

  capacity(config) {
    return toMbps(requestsPerSecond(config), S3_ASSUMED.objectBytes);
  },

  newState(config) {
    return newRampState(baseRps(resolve(S3_DEFAULTS, config).tier));
  },

  evaluate(config, state) {
    const c = resolve(S3_DEFAULTS, config);
    const archive = ARCHIVE_TIERS.has(c.tier);
    return (ctx) => {
      const size = sizeOf(ctx, S3_ASSUMED.objectBytes);
      const demandRps = toRps(offeredMbps(ctx), size);
      const rps = capacityRps(c, state, ctx, demandRps);
      const scaling = state !== undefined && demandRps > rps;
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(archive ? mbps(0) : toMbps(rps, size)),
        splitEven(ctx.outputCount),
        note("request-rate bound per prefix; bytes bounded by caller NIC"),
        note(archive && "archive tier: no synchronous reads"),
        note(scaling && `partition scaling toward ${demandRps.toFixed(0)} rps (τ ${S3_ASSUMED.rampTauS} s assumed): 503 SlowDown meanwhile`),
      );
    };
  },
};
