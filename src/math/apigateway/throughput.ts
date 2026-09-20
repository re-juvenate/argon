import { ModelTier, type ServiceModel } from "../../types/math";
import { bytes, KiB, cap, offered, pipe, resolve, sizeOf, toMbps } from "../utilities";

export interface ApiGatewayConfig {
  rateLimitRps?: number;
  burstRps?: number;
}

export const APIGATEWAY_DEFAULTS: Required<ApiGatewayConfig> = {
  // account-level default throttling budget
  rateLimitRps: 10_000,
  burstRps: 5_000,
};

// Assumed request payload when edges carry no size.
export const APIGATEWAY_ASSUMED = { requestBytes: bytes(2 * KiB) } as const;

export const model: ServiceModel<ApiGatewayConfig> = {
  defaults: APIGATEWAY_DEFAULTS,

  capacity(config) {
    const c = resolve(APIGATEWAY_DEFAULTS, config);
    return toMbps(c.rateLimitRps, APIGATEWAY_ASSUMED.requestBytes);
  },

  evaluate(config) {
    const c = resolve(APIGATEWAY_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, APIGATEWAY_ASSUMED.requestBytes);
      // Burst budget absorbs short spikes above the sustained rate.
      const burstRps = c.burstRps;
      const rps = c.rateLimitRps + burstRps / 60; // one burst spread over a minute
      return pipe(offered(ctx, ModelTier.Estimated), cap(toMbps(rps, size)));
    };
  },
};
