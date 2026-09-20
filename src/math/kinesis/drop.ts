import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, pipe, resolve, retried, SDK_RETRIES, startDrop } from "../utilities";
import { KINESIS_ASSUMED, KINESIS_DEFAULTS, shardCapacityMbps, type KinesisConfig } from "./throughput";

// ProvisionedThroughputExceeded over the shard budget (SDK-retried).
export const model: DropModel<KinesisConfig> = {
  defaults: KINESIS_DEFAULTS,

  evaluate(config) {
    const c = resolve(KINESIS_DEFAULTS, config);
    return (ctx) => {
      const size = ctx.avgBytes ?? KINESIS_ASSUMED.recordBytes;
      const r = startDrop(ctx, mbps(shardCapacityMbps(c.shards, size.value)), ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Throttle, retried(r.rawDrop, SDK_RETRIES)),
        note(r.rawDrop.value > 0 && `ProvisionedThroughputExceeded: ${c.shards} shard(s) at 1 MiB/s · 1,000 rec/s each`),
      );
    };
  },
};
