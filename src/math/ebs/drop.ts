import { ModelTier, type DropModel } from "../../types/math";
import { note, pipe, ratio, resolve, sizeOf, startDrop } from "../utilities";
import { EBS_ASSUMED, EBS_DEFAULTS, volumeLimits, type EBSConfig } from "./throughput";

export const model: DropModel<EBSConfig> = {
  defaults: EBS_DEFAULTS,

  evaluate(config) {
    const c = resolve(EBS_DEFAULTS, config);
    return (ctx) => {
      const r = startDrop(ctx, volumeLimits(c, sizeOf(ctx, EBS_ASSUMED.ioBytes)).burst, ModelTier.Measured);
      return pipe(
        r,
        (d) => ({ ...d, dropRate: ratio(0) }),
        note(r.rawDrop.value > 0 && "block I/O never fails on throttle: the excess queues (see latency)"),
        note("volume failure (AFR ≤ 0.2%/yr, io2 0.001%) below tick resolution"),
      );
    };
  },
};
