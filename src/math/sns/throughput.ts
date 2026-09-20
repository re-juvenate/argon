import { ModelTier, type ServiceModel } from "../../types/math";
import { bytes, cap, KiB, offered, pipe, resolve, sizeOf, splitEven, toMbps } from "../utilities";

export interface SNSConfig {
  subscribers?: number;
}

export const SNS_DEFAULTS: Required<SNSConfig> = {
  subscribers: 3,
};

// Fanout payload assumption when edges carry no size.
export const SNS_ASSUMED = { msgBytes: bytes(8 * KiB) } as const;

// Regional publish quota (soft default).
export const PUBLISH_RPS = 3000;

export const model: ServiceModel<SNSConfig> = {
  defaults: SNS_DEFAULTS,

  capacity(config) {
    return toMbps(PUBLISH_RPS, SNS_ASSUMED.msgBytes);
  },

  evaluate(config) {
    const c = resolve(SNS_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, SNS_ASSUMED.msgBytes);
      return pipe(offered(ctx, ModelTier.Estimated), cap(toMbps(PUBLISH_RPS, size)), splitEven(c.subscribers));
    };
  },
};
