import { ModelTier, type ServiceModel } from "../../types/math";
import { bytes, cap, KiB, mbps, MiB, offered, pipe, resolve, sizeOf, toMbps } from "../utilities";

export interface KinesisConfig {
  shards?: number;
}

export const KINESIS_DEFAULTS: Required<KinesisConfig> = {
  shards: 4,
};

// Per shard: 1 MiB/s ingest AND 1,000 records/s, whichever binds first.
export const SHARD_INGEST_BYTES_S = bytes(MiB);
export const SHARD_RECORDS_S = 1000;

// Assumed record payload when edges carry no size.
export const KINESIS_ASSUMED = { recordBytes: bytes(KiB) } as const;

// Capacity in Mbps for `size`-byte records.
export const shardCapacityMbps = (shards: number, recordBytes: number): number =>
  shards * Math.min(
    (SHARD_INGEST_BYTES_S.value * 8) / 1e6,
    toMbps(SHARD_RECORDS_S, bytes(recordBytes)).value,
  );

export const model: ServiceModel<KinesisConfig> = {
  defaults: KINESIS_DEFAULTS,

  capacity(config) {
    const c = resolve(KINESIS_DEFAULTS, config);
    return mbps(shardCapacityMbps(c.shards, KINESIS_ASSUMED.recordBytes.value));
  },

  evaluate(config) {
    const c = resolve(KINESIS_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, KINESIS_ASSUMED.recordBytes);
      return pipe(offered(ctx, ModelTier.Measured), cap(mbps(shardCapacityMbps(c.shards, size.value))));
    };
  },
};
