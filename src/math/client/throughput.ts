import { ModelTier, type ServiceModel } from "../../types/math";
import { bytes, KiB, offered, pipe, resolve, splitEven, toMbps } from "../utilities";

export interface ClientConfig {
  rps?: number;
  avgBytes?: number;
  noiseMin?: number;
  noiseMax?: number;
  noiseEnabled?: boolean;
}

export const CLIENT_DEFAULTS: Required<ClientConfig> = { 
  rps: 100, 
  avgBytes: 4 * KiB,
  noiseMin: 0.5,
  noiseMax: 1.5,
  noiseEnabled: false,
};

export const sourceMbps = (config?: ClientConfig, randomize = false) => {
  const c = resolve(CLIENT_DEFAULTS, config);
  const factor = (randomize && c.noiseEnabled) ? c.noiseMin + Math.random() * (c.noiseMax - c.noiseMin) : 1.0;
  return toMbps(c.rps * factor, bytes(c.avgBytes));
};

export const model: ServiceModel<ClientConfig> = {
  defaults: CLIENT_DEFAULTS,

  capacity(config) {
    return sourceMbps(config);
  },

  evaluate(config) {
    return (ctx) => {
      const source = sourceMbps(config, true);
      return pipe(offered(ctx, ModelTier.Assumed, source), splitEven(ctx.outputCount));
    };
  },
};
