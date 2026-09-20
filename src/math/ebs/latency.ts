import { ModelTier, type LatencyModel, type Milliseconds } from "../../types/math";
import { ms, note, offeredMbps, pipe, resolve, sizeOf, start, tail } from "../utilities";
import { EBS_ASSUMED, EBS_DEFAULTS, volumeLimits, VolumeType, type EBSConfig } from "./throughput";

export const EBS_LATENCY: Record<VolumeType, { p50Ms: Milliseconds; p99Ms: Milliseconds; tier: ModelTier }> = {
  [VolumeType.GP3]: { p50Ms: ms(1), p99Ms: ms(4), tier: ModelTier.Assumed },
  [VolumeType.GP2]: { p50Ms: ms(1), p99Ms: ms(4), tier: ModelTier.Assumed },
  [VolumeType.IO1]: { p50Ms: ms(0.8), p99Ms: ms(3), tier: ModelTier.Assumed },
  [VolumeType.IO2]: { p50Ms: ms(0.5), p99Ms: ms(0.8), tier: ModelTier.Measured },
  [VolumeType.ST1]: { p50Ms: ms(8), p99Ms: ms(30), tier: ModelTier.Assumed },
  [VolumeType.SC1]: { p50Ms: ms(8), p99Ms: ms(30), tier: ModelTier.Assumed },
};

export const model: LatencyModel<EBSConfig> = {
  defaults: EBS_DEFAULTS,

  evaluate(config) {
    const c = resolve(EBS_DEFAULTS, config);
    const l = EBS_LATENCY[c.volumeType];
    return (ctx) => {
      const capacity = volumeLimits(c, sizeOf(ctx, EBS_ASSUMED.ioBytes)).burst;
      const rho = capacity.value > 0 ? offeredMbps(ctx).value / capacity.value : 0;
      const backlogMs = rho > 1 ? (rho - 1) * 1000 : 0;
      return pipe(
        start(l.p50Ms, l.tier),
        (r) => ({ ...r, utilization: rho }),
        tail(ms(l.p99Ms.value + backlogMs)),
        note(c.volumeType === VolumeType.IO2 ? "io2 Block Express: < 500 µs average, < 800 µs outliers (AWS)" : '"single-digit millisecond" per AWS; values assumed'),
        note(backlogMs > 0 && `over capacity: I/O queues, +${backlogMs.toFixed(0)} ms at the tail`),
      );
    };
  },
};
