import { ModelTier, type Bytes, type Mbps, type ServiceModel } from "../../types/math";
import { bytes, cap, KiB, mbps, MiB, note, offered, pipe, resolve, sizeOf, toMbps } from "../utilities";

export interface KinesisConfig {
  shards?: number;
  enhancedFanOut?: boolean;
}

export const KINESIS_DEFAULTS: Required<KinesisConfig> = {
  shards: 4,
  enhancedFanOut: false,
};

export const KINESIS_FIXED = {
  shardWriteBytesS: MiB,
  shardWriteRecordsS: 1000,
  shardReadBytesS: 2 * MiB,
  shardReadTps: 5,
  maxRecordBytes: 10 * MiB,
  maxEfoConsumers: 20,
} as const;

export const KINESIS_ASSUMED = { recordBytes: bytes(KiB) } as const;

const bytesPerSecToMbps = (b: number): number => (b * 8) / 1e6;

export function writeCapacityMbps(shards: number, size: Bytes): { capacity: Mbps; recordsBound: boolean } {
  const byBytes = bytesPerSecToMbps(shards * KINESIS_FIXED.shardWriteBytesS);
  const byRecords = toMbps(shards * KINESIS_FIXED.shardWriteRecordsS, size).value;
  return { capacity: mbps(Math.min(byBytes, byRecords)), recordsBound: byRecords < byBytes };
}

export function readCapacityMbps(shards: number, consumers: number, efo: boolean): Mbps {
  const perShard = bytesPerSecToMbps(shards * KINESIS_FIXED.shardReadBytesS);
  return mbps(efo ? perShard * Math.max(1, consumers) : perShard);
}

export const model: ServiceModel<KinesisConfig> = {
  defaults: KINESIS_DEFAULTS,

  capacity(config) {
    return writeCapacityMbps(resolve(KINESIS_DEFAULTS, config).shards, KINESIS_ASSUMED.recordBytes).capacity;
  },

  evaluate(config) {
    const c = resolve(KINESIS_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, KINESIS_ASSUMED.recordBytes);
      const { capacity, recordsBound } = writeCapacityMbps(c.shards, size);
      const consumers = ctx.outputCount;
      const readCap = readCapacityMbps(c.shards, consumers, c.enhancedFanOut).value;
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(capacity),
        (r) => {
          if (consumers === 0) return r;
          const perConsumer = c.enhancedFanOut ? Math.min(r.servedMbps.value, readCap / consumers) : Math.min(r.servedMbps.value, readCap) / consumers;
          return { ...r, outputsMbps: Array.from({ length: consumers }, () => mbps(perConsumer)) };
        },
        note(`${c.shards} shard(s): ${recordsBound ? `${(c.shards * KINESIS_FIXED.shardWriteRecordsS).toLocaleString()} records/s binds` : `${c.shards} MiB/s ingest binds`} at ${(size.value / KiB).toFixed(1)} KiB records`),
        note(consumers > 1 && !c.enhancedFanOut && `${consumers} consumers share 2 MiB/s per shard (polling)`),
        note(c.enhancedFanOut && consumers > KINESIS_FIXED.maxEfoConsumers && `over the ${KINESIS_FIXED.maxEfoConsumers} enhanced fan-out consumer limit`),
      );
    };
  },
};
