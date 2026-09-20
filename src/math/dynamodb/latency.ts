import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, pipe, start, tail } from "../utilities";
import { DYNAMODB_DEFAULTS, type DynamoDBConfig } from "./throughput";

// Documented single-digit millisecond performance.
export const model: LatencyModel<DynamoDBConfig> = {
  defaults: DYNAMODB_DEFAULTS,

  evaluate(config) {
    const c = resolve(DYNAMODB_DEFAULTS, config);
    return () =>
      pipe(
        start(ms(4), ModelTier.Measured),
        tail(ms(c.consistentRead ? 15 : 10)),
        note(c.consistentRead && "strongly consistent reads pay a higher tail"),
      );
  },
};
