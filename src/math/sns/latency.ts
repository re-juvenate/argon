import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, pipe, start, tail } from "../utilities";
import { SNS_DEFAULTS, type SNSConfig } from "./throughput";

// Fanout delivery: publish accepted quickly, subscribers drained async.
export const model: LatencyModel<SNSConfig> = {
  defaults: SNS_DEFAULTS,

  evaluate() {
    return () =>
      pipe(
        start(ms(30), ModelTier.Measured),
        tail(ms(100)),
        note("fanout delivery: publish acknowledged, subscribers drain async"),
      );
  },
};
