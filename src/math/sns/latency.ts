import { ModelTier, type LatencyModel, type Milliseconds } from "../../types/math";
import { ms, note, pipe, resolve, start, tail } from "../utilities";
import { SNS_DEFAULTS, type SNSConfig } from "./throughput";

export const SNS_LATENCY_MEASURED: Record<"standard" | "fifo", { p50Ms: Milliseconds; p99Ms: Milliseconds }> = {
  standard: { p50Ms: ms(73), p99Ms: ms(225) },
  fifo: { p50Ms: ms(40.1), p99Ms: ms(497) },
};

export const model: LatencyModel<SNSConfig> = {
  defaults: SNS_DEFAULTS,

  evaluate(config) {
    const c = resolve(SNS_DEFAULTS, config);
    const m = SNS_LATENCY_MEASURED[c.fifo ? "fifo" : "standard"];
    return () =>
      pipe(
        start(m.p50Ms, ModelTier.Measured),
        tail(m.p99Ms),
        note("measured publish→subscriber end-to-end (Lambda→SNS→Lambda, eu-west-1, 2022)"),
        note("no queue: over-quota publishes are throttled, not held"),
      );
  },
};
