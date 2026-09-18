import { ModelTier, type LatencyModel, type Milliseconds } from "../../types/math";
import { ms, note, offeredMbps, pipe, resolve, start } from "../utilities";
import { model as throughput, QueueType, SQS_DEFAULTS, type SQSConfig } from "./throughput";

// Measured end-to-end percentiles (lucvandonkersgoed 2022). No backlog term: the consumer rate
// is downstream and not in the context.
// Spec: .references/reduced-formulas-latency.md §3.5

export const SQS_LATENCY_MEASURED: Record<QueueType, { p50Ms: Milliseconds; p99Ms: Milliseconds }> = {
  [QueueType.Standard]: { p50Ms: ms(16.2), p99Ms: ms(105) },
  [QueueType.FIFO]: { p50Ms: ms(28.1), p99Ms: ms(645) },
};

export const model: LatencyModel<SQSConfig> = {
  defaults: SQS_DEFAULTS,

  evaluate(config) {
    const c = resolve(SQS_DEFAULTS, config);
    const measured = SQS_LATENCY_MEASURED[c.queueType];
    const capacity = throughput.capacity(c);
    return (ctx) => {
      const rho = Number.isFinite(capacity.value) && capacity.value > 0 ? offeredMbps(ctx).value / capacity.value : 0;
      return pipe(
        start(measured.p50Ms, ModelTier.Measured),
        (r) => ({ ...r, p99Ms: measured.p99Ms, utilization: rho }),
        note("measured end-to-end percentiles; consumer backlog not modelled (consumer rate unknown)"),
        note(rho >= 1 && "FIFO quota exceeded: throttled (loss), latency of delivered messages unchanged"),
      );
    };
  },
};
