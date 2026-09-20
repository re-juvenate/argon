import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, pipe, resolve, start, tail } from "../utilities";
import { DYNAMODB_DEFAULTS, type DynamoDBConfig } from "./throughput";

export const DYNAMODB_LATENCY = {
  p50Ms: ms(4),
  p99Ms: ms(10),
  consistentP99Ms: ms(15),
  transactionalP99Ms: ms(20),
} as const;

export const model: LatencyModel<DynamoDBConfig> = {
  defaults: DYNAMODB_DEFAULTS,

  evaluate(config) {
    const c = resolve(DYNAMODB_DEFAULTS, config);
    const p99 = c.transactional ? DYNAMODB_LATENCY.transactionalP99Ms : c.consistentRead ? DYNAMODB_LATENCY.consistentP99Ms : DYNAMODB_LATENCY.p99Ms;
    return () =>
      pipe(
        start(DYNAMODB_LATENCY.p50Ms, ModelTier.Assumed),
        tail(p99),
        note('"single-digit millisecond" per AWS; percentiles assumed'),
        note(c.consistentRead && "strongly consistent reads hit the leader replica: higher tail"),
        note(c.transactional && "transactional reads: two-phase, highest tail"),
      );
  },
};
