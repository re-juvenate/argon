import { ModelTier, type ServiceModel } from "../../types/math";
import { bytes, KiB, offered, pipe, resolve, splitEven, toMbps } from "../utilities";

export interface ClientConfig {
  rps?: number;
  avgBytes?: number;
}

export const CLIENT_DEFAULTS: Required<ClientConfig> = { rps: 100, avgBytes: 4 * KiB };

export const sourceMbps = (config?: ClientConfig) => {
  const c = resolve(CLIENT_DEFAULTS, config);
  return toMbps(c.rps, bytes(c.avgBytes));
};

export const model: ServiceModel<ClientConfig> = {
  defaults: CLIENT_DEFAULTS,

  capacity(config) {
    return sourceMbps(config);
  },

  evaluate(config) {
    const source = sourceMbps(config);
    return (ctx) => pipe(offered(ctx, ModelTier.Assumed, source), splitEven(ctx.outputCount));
  },
};
