import { ModelTier, type DropModel } from "../../types/math";
import { mbps, note, pipe, ratio, resolve, sizeOf, startDrop } from "../utilities";
import { EFS_ASSUMED, EFS_DEFAULTS, fsLimits, type EFSConfig } from "./throughput";

export const model: DropModel<EFSConfig> = {
  defaults: EFS_DEFAULTS,

  evaluate(config) {
    const c = resolve(EFS_DEFAULTS, config);
    return (ctx) => {
      const l = fsLimits(c, sizeOf(ctx, EFS_ASSUMED.opBytes));
      const r = startDrop(ctx, mbps(Math.min(l.burst.value, l.perClient.value, l.iopsCap.value)), ModelTier.Measured);
      return pipe(
        r,
        (d) => ({ ...d, dropRate: ratio(0) }),
        note(r.rawDrop.value > 0 && "NFS never fails on throttle: requests wait (see latency)"),
      );
    };
  },
};
