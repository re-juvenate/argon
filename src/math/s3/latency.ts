import { ModelTier, type LatencyModel, type Milliseconds } from "../../types/math";
import { mbps, ms, note, offeredMbps, pipe, resolve, start, xferMs } from "../utilities";
import { GlacierRetrievalSpeed, S3StorageTier } from "./cost";
import { ARCHIVE_TIERS, model as throughput, S3_ASSUMED, S3_DEFAULTS, type S3Config } from "./throughput";

// Documented TTFB + single-connection transfer; a throttled prefix costs one SDK backoff.
// Archive classes: the documented retrieval window.
// Spec: .references/reduced-formulas-latency.md §3.7

const MIN = 60_000;
const HOUR = 3_600_000;

export const S3_LATENCY_MEASURED = {
  // docs: "roughly 100–200 ms"
  ttfb: { p50Ms: ms(150), p99Ms: ms(200) },
  // Express One Zone is not in S3StorageTier yet
  ttfbExpress: { p50Ms: ms(5), p99Ms: ms(10) },
  // measured 125–215 MB/s (r/aws)
  perConnMbps: mbps(1000),
  // AWS retrieval-options doc, lower / upper bound
  archive: {
    [S3StorageTier.GLACIER_FLEXIBLE]: {
      [GlacierRetrievalSpeed.EXPEDITED]: { p50Ms: ms(1 * MIN), p99Ms: ms(5 * MIN) },
      [GlacierRetrievalSpeed.STANDARD]: { p50Ms: ms(3 * HOUR), p99Ms: ms(5 * HOUR) },
      [GlacierRetrievalSpeed.BULK]: { p50Ms: ms(5 * HOUR), p99Ms: ms(12 * HOUR) },
    },
    [S3StorageTier.DEEP_ARCHIVE]: {
      // no expedited option
      [GlacierRetrievalSpeed.EXPEDITED]: { p50Ms: ms(12 * HOUR), p99Ms: ms(12 * HOUR) },
      [GlacierRetrievalSpeed.STANDARD]: { p50Ms: ms(12 * HOUR), p99Ms: ms(12 * HOUR) },
      [GlacierRetrievalSpeed.BULK]: { p50Ms: ms(48 * HOUR), p99Ms: ms(48 * HOUR) },
    },
  } as Partial<Record<S3StorageTier, Record<GlacierRetrievalSpeed, { p50Ms: Milliseconds; p99Ms: Milliseconds }>>>,
} as const;

export const S3_LATENCY_ASSUMED = {
  // SDK retry base delay
  backoffMs: ms(100),
} as const;

export const model: LatencyModel<S3Config> = {
  defaults: S3_DEFAULTS,

  evaluate(config) {
    const c = resolve(S3_DEFAULTS, config);
    const archive = ARCHIVE_TIERS.has(c.tier) ? S3_LATENCY_MEASURED.archive[c.tier]?.[c.retrieval] : undefined;
    const xfer = xferMs(S3_ASSUMED.objectBytes, S3_LATENCY_MEASURED.perConnMbps);
    const capacity = throughput.capacity(c);
    return (ctx) => {
      if (archive !== undefined) {
        return pipe(
          start(archive.p50Ms, ModelTier.Measured),
          (r) => ({ ...r, p99Ms: archive.p99Ms }),
          note(`archive tier: ${c.retrieval.toLowerCase()} retrieval window, restore-then-read`),
        );
      }
      const ttfb = S3_LATENCY_MEASURED.ttfb;
      const rho = capacity.value > 0 ? offeredMbps(ctx).value / capacity.value : 0;
      const retry = rho > 1 ? S3_LATENCY_ASSUMED.backoffMs.value : 0;
      return pipe(
        start(ms(ttfb.p50Ms.value + xfer.value), ModelTier.Measured),
        (r) => ({ ...r, p99Ms: ms(ttfb.p99Ms.value + xfer.value + retry), utilization: rho }),
        note(`TTFB ${ttfb.p50Ms.value}/${ttfb.p99Ms.value} ms (docs) + ${xfer.value.toFixed(2)} ms transfer at ${S3_LATENCY_MEASURED.perConnMbps.value} Mbps`),
        note(retry > 0 && "prefix over request quota: 503 SlowDown, one SDK backoff added (assumed 100 ms)"),
      );
    };
  },
};
