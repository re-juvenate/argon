import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, pipe, resolve, retried, SDK_RETRIES, startDrop, toMbps } from "../utilities";
import { DYNAMODB_ASSUMED, DYNAMODB_DEFAULTS, readRps, type DynamoDBConfig } from "./throughput";

// ProvisionedThroughputExceeded over the RCU budget (SDK-retried).
export const model: DropModel<DynamoDBConfig> = {
  defaults: DYNAMODB_DEFAULTS,

  evaluate(config) {
    const c = resolve(DYNAMODB_DEFAULTS, config);
    return (ctx) => {
      const size = ctx.avgBytes ?? DYNAMODB_ASSUMED.itemBytes;
      const r = startDrop(ctx, toMbps(readRps(c.readCapacityUnits, c.consistentRead, size.value), size), ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Throttle, retried(r.rawDrop, SDK_RETRIES)),
        note(r.rawDrop.value > 0 && `ProvisionedThroughputExceeded: ${c.readCapacityUnits} RCU budget exceeded`),
      );
    };
  },
};
