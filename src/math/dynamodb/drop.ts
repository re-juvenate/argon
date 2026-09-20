import { DropKind, ModelTier, type CreditState, type DropModel } from "../../types/math";
import { cause, note, pipe, resolve, retried, SDK_RETRIES, sizeOf, startDrop } from "../utilities";
import { DYNAMODB_ASSUMED, DYNAMODB_DEFAULTS, provisionedMbps, type DynamoDBConfig } from "./throughput";

export const model: DropModel<DynamoDBConfig, CreditState> = {
  defaults: DYNAMODB_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(DYNAMODB_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, DYNAMODB_ASSUMED.itemBytes);
      const { base } = provisionedMbps(c, size);
      const capacity = state?.availableMbps ?? base;
      const r = startDrop(ctx, capacity, ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Throttle, retried(r.rawDrop, SDK_RETRIES)),
        note(r.rawDrop.value > 0 && `ProvisionedThroughputExceededException: ${c.readCapacityUnits} RCU budget exceeded (burst credits spent)`),
        note(r.rawDrop.value > 0 && `SDK default is 10 retries for DynamoDB; ${SDK_RETRIES} used here`),
      );
    };
  },
};
