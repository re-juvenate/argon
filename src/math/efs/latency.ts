import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, offeredMbps, pipe, resolve, sizeOf, start, tail } from "../utilities";
import { EFS_ASSUMED, EFS_DEFAULTS, fsLimits, PerformanceMode, type EFSConfig } from "./throughput";

export const EFS_LATENCY = {
  readMs: 1,
  writeMs: 2.7,
  p99Ms: 5,
  maxIoFactor: 3,
} as const;

export const model: LatencyModel<EFSConfig> = {
  defaults: EFS_DEFAULTS,

  evaluate(config) {
    const c = resolve(EFS_DEFAULTS, config);
    const factor = c.performanceMode === PerformanceMode.MaxIO ? EFS_LATENCY.maxIoFactor : 1;
    const p50 = (EFS_ASSUMED.readFraction * EFS_LATENCY.readMs + (1 - EFS_ASSUMED.readFraction) * EFS_LATENCY.writeMs) * factor;
    return (ctx) => {
      const l = fsLimits(c, sizeOf(ctx, EFS_ASSUMED.opBytes));
      const capacity = Math.min(l.burst.value, l.perClient.value, l.iopsCap.value);
      const rho = capacity > 0 ? offeredMbps(ctx).value / capacity : 0;
      const backlogMs = rho > 1 ? (rho - 1) * 1000 : 0;
      return pipe(
        start(ms(p50), ModelTier.Measured),
        (r) => ({ ...r, utilization: rho }),
        tail(ms(EFS_LATENCY.p99Ms * factor + backlogMs)),
        note(`~1 ms reads / ~2.7 ms writes (AWS), ${Math.round(EFS_ASSUMED.readFraction * 100)}% reads assumed`),
        note(factor > 1 && "Max I/O: higher per-operation latency (×3 assumed; AWS gives no figure)"),
        note(backlogMs > 0 && `over throughput budget: NFS requests wait, +${backlogMs.toFixed(0)} ms at the tail`),
      );
    };
  },
};
