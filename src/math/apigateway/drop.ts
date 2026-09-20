import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, offeredMbps, pipe, resolve, retried, SDK_RETRIES, sizeOf, startDrop, toMbps, toRps } from "../utilities";
import { APIGATEWAY_ASSUMED, APIGATEWAY_DEFAULTS, quotaFor, tokenBucketRps, type ApiGatewayConfig, type TokenBucketState } from "./throughput";

export const model: DropModel<ApiGatewayConfig, TokenBucketState> = {
  defaults: APIGATEWAY_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(APIGATEWAY_DEFAULTS, config);
    const { rateRps, burst } = quotaFor(c);
    return (ctx) => {
      const size = sizeOf(ctx, APIGATEWAY_ASSUMED.requestBytes);
      const demandRps = toRps(offeredMbps(ctx), size);
      const servedRps = state && ctx.dt !== undefined ? tokenBucketRps(state, demandRps, rateRps, burst, ctx) : Math.min(demandRps, rateRps);
      const r = startDrop(ctx, toMbps(Math.max(servedRps, Math.min(demandRps, rateRps)), size), ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Throttle, retried(r.rawDrop, SDK_RETRIES)),
        note(r.rawDrop.value > 0 && `429 Too Many Requests: ${rateRps.toLocaleString()} rps sustained, ${burst.toLocaleString()}-token burst spent`),
      );
    };
  },
};
