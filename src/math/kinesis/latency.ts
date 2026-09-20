import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, pipe, resolve, start, tail } from "../utilities";
import { KINESIS_DEFAULTS, type KinesisConfig } from "./throughput";

export const KINESIS_LATENCY_MEASURED = {
  polling: { p50Ms: ms(627), p99Ms: ms(1580) },
  efo: { p50Ms: ms(49.4), p99Ms: ms(109) },
  pollingPerExtraConsumer: 0.2,
} as const;

export const model: LatencyModel<KinesisConfig> = {
  defaults: KINESIS_DEFAULTS,

  evaluate(config) {
    const c = resolve(KINESIS_DEFAULTS, config);
    return (ctx) => {
      const consumers = Math.max(1, ctx.outputCount);
      const m = c.enhancedFanOut ? KINESIS_LATENCY_MEASURED.efo : KINESIS_LATENCY_MEASURED.polling;
      const scale = c.enhancedFanOut ? 1 : 1 + KINESIS_LATENCY_MEASURED.pollingPerExtraConsumer * (consumers - 1);
      return pipe(
        start(ms(m.p50Ms.value * scale), ModelTier.Measured),
        tail(ms(m.p99Ms.value * scale)),
        note(c.enhancedFanOut ? "enhanced fan-out: ~70 ms propagation, independent of consumers" : "polling: ~200 ms propagation with 1 consumer, ~1,000 ms with 5"),
        note(scale > 1 && `${consumers} polling consumers: ×${scale.toFixed(1)}`),
      );
    };
  },
};
