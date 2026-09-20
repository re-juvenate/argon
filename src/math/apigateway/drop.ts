import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, pipe, resolve, retried, SDK_RETRIES, startDrop, toMbps } from "../utilities";
import { APIGATEWAY_ASSUMED, APIGATEWAY_DEFAULTS, type ApiGatewayConfig } from "./throughput";

// Sustained rate exceeded → 429 ThrottlingException (SDK-retried).
export const model: DropModel<ApiGatewayConfig> = {
  defaults: APIGATEWAY_DEFAULTS,

  evaluate(config) {
    const c = resolve(APIGATEWAY_DEFAULTS, config);
    return (ctx) => {
      const size = ctx.avgBytes ?? APIGATEWAY_ASSUMED.requestBytes;
      const rps = c.rateLimitRps;
      const r = startDrop(ctx, toMbps(rps, size), ModelTier.Estimated);
      return pipe(
        r,
        cause(DropKind.Throttle, retried(r.rawDrop, SDK_RETRIES)),
        note(r.rawDrop.value > 0 && `429 ThrottlingException: account rate limit ${rps.toLocaleString()} rps exceeded`),
      );
    };
  },
};
