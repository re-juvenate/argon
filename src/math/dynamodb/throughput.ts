import { ModelTier, type ServiceModel } from "../../types/math";
import { bytes, cap, KiB, offered, pipe, resolve, sizeOf, toMbps } from "../utilities";

export interface DynamoDBConfig {
  readCapacityUnits?: number;
  consistentRead?: boolean;
}

export const DYNAMODB_DEFAULTS: Required<DynamoDBConfig> = {
  readCapacityUnits: 5,
  consistentRead: false,
};

// Items above 4 KiB cost extra RCUs; below, reads pack 4-per-RCU.
export const DYNAMODB_ASSUMED = { itemBytes: bytes(KiB), maxItemBytes: bytes(4 * KiB) } as const;

// Reads per second the table can serve at `size` per item.
export const readRps = (rcu: number, consistent: boolean, itemBytes: number): number => {
  const readsPerRcu = (consistent ? 1 : 2) * (DYNAMODB_ASSUMED.maxItemBytes.value / Math.max(itemBytes, 1));
  return rcu * readsPerRcu;
};

export const model: ServiceModel<DynamoDBConfig> = {
  defaults: DYNAMODB_DEFAULTS,

  capacity(config) {
    const c = resolve(DYNAMODB_DEFAULTS, config);
    return toMbps(readRps(c.readCapacityUnits, c.consistentRead, DYNAMODB_ASSUMED.itemBytes.value), DYNAMODB_ASSUMED.itemBytes);
  },

  evaluate(config) {
    const c = resolve(DYNAMODB_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, DYNAMODB_ASSUMED.itemBytes);
      return pipe(offered(ctx, ModelTier.Measured), cap(toMbps(readRps(c.readCapacityUnits, c.consistentRead, size.value), size)));
    };
  },
};
