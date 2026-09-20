import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, num, parseCsv, pipe, ratio, resolve, retried, SDK_RETRIES, sizeOf, startDrop, toMbps } from "../utilities";
import { S3StorageTier } from "./cost";
import { ARCHIVE_TIERS, capacityRps, S3_ASSUMED, S3_DEFAULTS, type S3Config, type S3State } from "./throughput";
import tiersCsv from "./tiers.csv?raw";

// 503 SlowDown over the per-prefix quota (SDK-retried) + availability design from tiers.csv.
// Archive tiers: capacity 0 → rawDrop 1.
// Spec: .references/reduced-formulas-drop.md §3.7

// S3StorageTier → tiers.csv "Storage Class"
const TIER_ROW: Record<S3StorageTier, string> = {
  [S3StorageTier.STANDARD]: "S3 Standard",
  [S3StorageTier.INFREQUENT_ACCESS]: "S3 Standard-IA",
  [S3StorageTier.ONE_ZONE_IA]: "S3 One Zone-IA",
  [S3StorageTier.GLACIER_INSTANT]: "S3 Glacier Instant Retrieval",
  [S3StorageTier.GLACIER_FLEXIBLE]: "S3 Glacier Flexible Retrieval",
  [S3StorageTier.DEEP_ARCHIVE]: "S3 Glacier Deep Archive",
  [S3StorageTier.INTELLIGENT_TIERING]: "S3 Intelligent-Tiering (Frequent)",
  [S3StorageTier.EXPRESS_ONE_ZONE]: "S3 Express One Zone",
};

const AVAILABILITY: Record<string, number> = Object.fromEntries(
  parseCsv(tiersCsv).map((row) => [row["Storage Class"], num(row["Availability Design"]?.replace("%", ""), NaN) / 100]),
);

export const STORAGE_FEES: Record<string, number> = Object.fromEntries(
  parseCsv(tiersCsv).map((row) => [row["Storage Class"], num(row["Storage Fee per GB Month (USD)"], 0)]),
);

export function storageFee(tier: S3StorageTier): number {
  return STORAGE_FEES[TIER_ROW[tier]] || 0;
}

export function availabilityDesign(tier: S3StorageTier): number | undefined {
  const a = AVAILABILITY[TIER_ROW[tier]];
  return Number.isFinite(a) ? a : undefined;
}

export const model: DropModel<S3Config, S3State> = {
  defaults: S3_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(S3_DEFAULTS, config);
    const availability = availabilityDesign(c.tier);
    const archive = ARCHIVE_TIERS.has(c.tier);
    return (ctx) => {
      const capacity = archive ? toMbps(0, S3_ASSUMED.objectBytes) : toMbps(capacityRps(c, state, ctx), sizeOf(ctx, S3_ASSUMED.objectBytes));
      const r = startDrop(ctx, capacity, ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Throttle, archive ? r.rawDrop : retried(r.rawDrop, SDK_RETRIES)),
        cause(DropKind.Unavailable, ratio(availability === undefined ? 0 : 1 - availability)),
        note(archive && "archive tier: no synchronous reads"),
        note(!archive && r.rawDrop.value > 0 && `503 SlowDown: raw ${(r.rawDrop.value * 100).toFixed(1)}% (sustained bound) before ${SDK_RETRIES} SDK retries`),
        note(availability !== undefined ? `availability design ${(availability * 100).toFixed(2)}% (tiers.csv)` : "no availability row in tiers.csv"),
      );
    };
  },
};
