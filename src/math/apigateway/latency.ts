import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, pipe, resolve, start, tail } from "../utilities";
import { APIGATEWAY_DEFAULTS, ApiType, type ApiGatewayConfig } from "./throughput";

export const APIGATEWAY_LATENCY = {
  [ApiType.HTTP]: { p50Ms: ms(5), p99Ms: ms(10), tier: ModelTier.Measured },
  [ApiType.REST]: { p50Ms: ms(15), p99Ms: ms(25), tier: ModelTier.Assumed },
} as const;

export const model: LatencyModel<ApiGatewayConfig> = {
  defaults: APIGATEWAY_DEFAULTS,

  evaluate(config) {
    const c = resolve(APIGATEWAY_DEFAULTS, config);
    const l = APIGATEWAY_LATENCY[c.apiType];
    return () =>
      pipe(
        start(l.p50Ms, l.tier),
        tail(l.p99Ms),
        note(c.apiType === ApiType.HTTP ? "HTTP API: < 10 ms added at p99 (AWS)" : "REST API overhead assumed 15 ms p50"),
        note("no queue: over-rate requests are rejected with 429, not held"),
      );
  },
};
