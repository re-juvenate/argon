import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, pipe, resolve, retried, startDrop } from "../utilities";
import { model as throughput, QueueType, SQS_DEFAULTS, type SQSConfig } from "./throughput";

// FIFO over quota → ThrottlingException, retried by the SDK. Retention expiry / DLQ need backlog state.
// Spec: .references/reduced-formulas-drop.md §3.5

export const SQS_DROP_ASSUMED = { sdkRetries: 3 } as const;

export const model: DropModel<SQSConfig> = {
  defaults: SQS_DEFAULTS,

  evaluate(config) {
    const c = resolve(SQS_DEFAULTS, config);
    const capacity = throughput.capacity(c);
    return (ctx) => {
      const r = startDrop(ctx, capacity, ModelTier.Measured);
      const throttled = c.queueType === QueueType.FIFO ? r.rawDrop : { ...r.rawDrop, value: 0 };
      return pipe(
        r,
        cause(DropKind.Throttle, retried(throttled, SQS_DROP_ASSUMED.sdkRetries)),
        note(throttled.value > 0 && `FIFO quota: raw throttle ${(throttled.value * 100).toFixed(1)}% before ${SQS_DROP_ASSUMED.sdkRetries} SDK retries`),
        note("retention expiry / DLQ not modelled (no backlog state)"),
      );
    };
  },
};
