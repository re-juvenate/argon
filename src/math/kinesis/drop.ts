import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, pipe, resolve, retried, SDK_RETRIES, sizeOf, startDrop } from "../utilities";
import { KINESIS_ASSUMED, KINESIS_DEFAULTS, writeCapacityMbps, type KinesisConfig } from "./throughput";

export const model: DropModel<KinesisConfig> = {
  defaults: KINESIS_DEFAULTS,

  evaluate(config) {
    const c = resolve(KINESIS_DEFAULTS, config);
    return (ctx) => {
      const r = startDrop(ctx, writeCapacityMbps(c.shards, sizeOf(ctx, KINESIS_ASSUMED.recordBytes)).capacity, ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Throttle, retried(r.rawDrop, SDK_RETRIES)),
        note(r.rawDrop.value > 0 && `ProvisionedThroughputExceededException: ${c.shards} shard(s) at 1 MiB/s · 1,000 records/s each`),
      );
    };
  },
};
