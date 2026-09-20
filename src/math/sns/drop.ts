import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, pipe, resolve, retried, SDK_RETRIES, sizeOf, startDrop } from "../utilities";
import { capacityFor, publishRps, SNS_ASSUMED, SNS_DEFAULTS, type SNSConfig } from "./throughput";

export const SNS_DELIVERY_RETRIES = { awsManaged: 100_014, http: 3 } as const;

export const model: DropModel<SNSConfig> = {
  defaults: SNS_DEFAULTS,

  evaluate(config) {
    const c = resolve(SNS_DEFAULTS, config);
    return (ctx) => {
      const r = startDrop(ctx, capacityFor(c, sizeOf(ctx, SNS_ASSUMED.msgBytes)), ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Throttle, retried(r.rawDrop, SDK_RETRIES)),
        note(r.rawDrop.value > 0 && `ThrottledException: ${publishRps(c).toLocaleString()} msg/s ${c.fifo ? "FIFO topic" : c.region} quota exceeded`),
        note("delivery retries (100,015 attempts to Lambda/SQS, 3 to HTTP/S) make subscriber-side loss ≈ 0; not modelled"),
      );
    };
  },
};
