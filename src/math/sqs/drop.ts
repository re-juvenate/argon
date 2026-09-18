import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, pipe, resolve, retried, SDK_RETRIES, sizeOf, startDrop } from "../utilities";
import { capacityFor, QueueType, SQS_ASSUMED, SQS_DEFAULTS, type SQSConfig } from "./throughput";

// FIFO over quota → ThrottlingException, retried by the SDK. Retention expiry / DLQ need backlog state.
// Spec: .references/reduced-formulas-drop.md §3.5

export const model: DropModel<SQSConfig> = {
  defaults: SQS_DEFAULTS,

  evaluate(config) {
    const c = resolve(SQS_DEFAULTS, config);
    return (ctx) => {
      const r = startDrop(ctx, capacityFor(c, sizeOf(ctx, SQS_ASSUMED.msgBytes)), ModelTier.Measured);
      const throttled = c.queueType === QueueType.FIFO ? r.rawDrop : { ...r.rawDrop, value: 0 };
      return pipe(
        r,
        cause(DropKind.Throttle, retried(throttled, SDK_RETRIES)),
        note(throttled.value > 0 && `FIFO quota: raw throttle ${(throttled.value * 100).toFixed(1)}% before ${SDK_RETRIES} SDK retries`),
        note("retention expiry / DLQ not modelled (no backlog state)"),
      );
    };
  },
};
