import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, pipe, retried, SDK_RETRIES, startDrop, toMbps } from "../utilities";
import { PUBLISH_RPS, SNS_ASSUMED, SNS_DEFAULTS, type SNSConfig } from "./throughput";

// Publish quota exceeded → ThrottledException (SDK-retried).
export const model: DropModel<SNSConfig> = {
  defaults: SNS_DEFAULTS,

  evaluate() {
    return (ctx) => {
      const size = ctx.avgBytes ?? SNS_ASSUMED.msgBytes;
      const r = startDrop(ctx, toMbps(PUBLISH_RPS, size), ModelTier.Estimated);
      return pipe(
        r,
        cause(DropKind.Throttle, retried(r.rawDrop, SDK_RETRIES)),
        note(r.rawDrop.value > 0 && `ThrottledException: publish quota ${PUBLISH_RPS.toLocaleString()} rps exceeded`),
      );
    };
  },
};
