import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, num, parseCsv, pipe, ratio, resolve, retried, startDrop } from "../utilities";
import { S3StorageTier } from "./cost";
import { ARCHIVE_TIERS, model as throughput, S3_DEFAULTS, type S3Config } from "./throughput";
import tiersCsv from "./tiers.csv?raw";

// 503 SlowDown over the per-prefix quota (SDK-retried) + availability design from tiers.csv.
// Archive tiers: capacity 0 → rawDrop 1.
// Spec: .references/reduced-formulas-drop.md §3.7

export const S3_DROP_ASSUMED = { sdkRetries: 3 } as const;

// S3StorageTier → tiers.csv "Storage Class"
const TIER_ROW: Record<S3StorageTier, string> = {
  [S3StorageTier.STANDARD]: "S3 Standard",
  [S3StorageTier.INFREQUENT_ACCESS]: "S3 Standard-IA",
  [S3StorageTier.ONE_ZONE_IA]: "S3 One Zone-IA",
  [S3StorageTier.GLACIER_INSTANT]: "S3 Glacier Instant Retrieval",
  [S3StorageTier.GLACIER_FLEXIBLE]: "S3 Glacier Flexible Retrieval",
  [S3StorageTier.DEEP_ARCHIVE]: "S3 Glacier Deep Archive",
};

const AVAILABILITY: Record<string, number> = Object.fromEntries(
  parseCsv(tiersCsv).map((row) => [row["Storage Class"], num(row["Availability Design"]?.replace("%", ""), NaN) / 100]),
);

export function availabilityDesign(tier: S3StorageTier): number | undefined {
  const a = AVAILABILITY[TIER_ROW[tier]];
  return Number.isFinite(a) ? a : undefined;
}

export const model: DropModel<S3Config> = {
  defaults: S3_DEFAULTS,

  evaluate(config) {
    const c = resolve(S3_DEFAULTS, config);
    const capacity = throughput.capacity(c);
    const availability = availabilityDesign(c.tier);
    return (ctx) => {
      const r = startDrop(ctx, capacity, ModelTier.Measured);
      const archive = ARCHIVE_TIERS.has(c.tier);
      return pipe(
        r,
        cause(DropKind.Throttle, archive ? r.rawDrop : retried(r.rawDrop, S3_DROP_ASSUMED.sdkRetries)),
        cause(DropKind.Unavailable, ratio(availability === undefined ? 0 : 1 - availability)),
        note(archive && "archive tier: no synchronous reads"),
        note(!archive && r.rawDrop.value > 0 && `503 SlowDown: raw ${(r.rawDrop.value * 100).toFixed(1)}% (sustained bound) before ${S3_DROP_ASSUMED.sdkRetries} SDK retries`),
        note(availability !== undefined ? `availability design ${(availability * 100).toFixed(2)}% (tiers.csv)` : "no availability row in tiers.csv"),
      );
    };
  },
};
