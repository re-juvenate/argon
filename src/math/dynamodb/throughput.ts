import { ModelTier, type Bytes, type CreditState, type ServiceModel } from "../../types/math";
import { bytes, cap, creditBucket, KiB, mbps, newCreditState, note, offered, offeredMbps, pipe, resolve, seconds, sizeOf, splitEven, toMbps } from "../utilities";

export interface DynamoDBConfig {
  readCapacityUnits?: number;
  consistentRead?: boolean;
  transactional?: boolean;
}

export const DYNAMODB_DEFAULTS: Required<DynamoDBConfig> = {
  readCapacityUnits: 5,
  consistentRead: false,
  transactional: false,
};

export const DYNAMODB_FIXED = {
  readUnitBytes: 4 * KiB,
  writeUnitBytes: KiB,
  partitionRcu: 3000,
  partitionWcu: 1000,
  burstSeconds: seconds(300),
  tableRcuQuota: 40_000,
} as const;

export const DYNAMODB_ASSUMED = {
  itemBytes: bytes(KiB),
  burstFactor: 3,
} as const;

export const unitsPerRead = (c: Required<DynamoDBConfig>, itemBytes: number): number =>
  Math.max(1, Math.ceil(itemBytes / DYNAMODB_FIXED.readUnitBytes)) * (c.transactional ? 2 : c.consistentRead ? 1 : 0.5);

export const readRps = (c: Required<DynamoDBConfig>, itemBytes: number): number => c.readCapacityUnits / unitsPerRead(c, itemBytes);

export const partitions = (rcu: number): number => Math.max(1, Math.ceil(rcu / DYNAMODB_FIXED.partitionRcu));

export const burstRps = (c: Required<DynamoDBConfig>, itemBytes: number): number =>
  Math.min(readRps(c, itemBytes) * DYNAMODB_ASSUMED.burstFactor, (partitions(c.readCapacityUnits) * DYNAMODB_FIXED.partitionRcu) / unitsPerRead(c, itemBytes));

export function provisionedMbps(c: Required<DynamoDBConfig>, size: Bytes) {
  return { base: toMbps(readRps(c, size.value), size), burst: toMbps(burstRps(c, size.value), size) };
}

export const model: ServiceModel<DynamoDBConfig, CreditState> = {
  defaults: DYNAMODB_DEFAULTS,

  capacity(config) {
    const c = resolve(DYNAMODB_DEFAULTS, config);
    return provisionedMbps(c, DYNAMODB_ASSUMED.itemBytes).base;
  },

  newState(config) {
    const { base, burst } = provisionedMbps(resolve(DYNAMODB_DEFAULTS, config), DYNAMODB_ASSUMED.itemBytes);
    return newCreditState(base, burst, DYNAMODB_FIXED.burstSeconds);
  },

  evaluate(config, state) {
    const c = resolve(DYNAMODB_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, DYNAMODB_ASSUMED.itemBytes);
      const { base, burst } = provisionedMbps(c, size);
      const available =
        state && ctx.dt !== undefined
          ? creditBucket({ baselineMbps: base, burstMbps: burst, demandMbps: offeredMbps(ctx), burstSeconds: DYNAMODB_FIXED.burstSeconds, ctx }, state)
          : base;
      const bursting = available.value > base.value && offeredMbps(ctx).value > base.value;
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(mbps(available.value)),
        splitEven(ctx.outputCount),
        note(`${c.readCapacityUnits} RCU → ${Math.round(readRps(c, size.value)).toLocaleString()} reads/s at ${Math.round(size.value / KiB)} KiB (${unitsPerRead(c, size.value)} RCU each)`),
        note(bursting && "burst capacity: spending up to 300 s of unused RCU"),
        note(c.readCapacityUnits > DYNAMODB_FIXED.tableRcuQuota && `above the 40,000 RCU per-table default quota`),
      );
    };
  },
};
