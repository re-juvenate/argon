import { ModelTier, type Mbps, type ServiceModel, type Stamped, type ThroughputContext } from "../../types/math";
import { advanced, bytes, cap, KiB, mbps, note, offered, offeredMbps, pipe, resolve, sizeOf, splitEven, toMbps, toRps } from "../utilities";

export enum ApiType {
  REST = "rest",
  HTTP = "http",
}

export interface ApiGatewayConfig {
  rateLimitRps?: number;
  burstRps?: number;
  apiType?: ApiType;
  region?: string;
}

export const APIGATEWAY_DEFAULTS: Required<ApiGatewayConfig> = {
  rateLimitRps: 10_000,
  burstRps: 5_000,
  apiType: ApiType.REST,
  region: "us-east-1",
};

export const APIGATEWAY_FIXED = {
  lowQuotaRegions: new Set([
    "af-south-1",
    "eu-south-1",
    "ap-southeast-3",
    "me-central-1",
    "ap-south-2",
    "ap-southeast-4",
    "eu-south-2",
    "eu-central-2",
    "il-central-1",
    "ca-west-1",
    "ap-southeast-5",
    "ap-southeast-7",
    "mx-central-1",
  ]),
  lowQuotaRps: 2_500,
  lowQuotaBurst: 1_250,
} as const;

export const APIGATEWAY_ASSUMED = { requestBytes: bytes(2 * KiB) } as const;

export interface TokenBucketState extends Stamped {
  tokens: number;
  servedRps?: number;
}

export function quotaFor(c: Required<ApiGatewayConfig>): { rateRps: number; burst: number } {
  const low = APIGATEWAY_FIXED.lowQuotaRegions.has(c.region);
  return {
    rateRps: Math.min(c.rateLimitRps, low ? APIGATEWAY_FIXED.lowQuotaRps : Infinity),
    burst: Math.min(c.burstRps, low ? APIGATEWAY_FIXED.lowQuotaBurst : Infinity),
  };
}

export function newTokenBucket(c: Required<ApiGatewayConfig>): TokenBucketState {
  return { tokens: quotaFor(c).burst };
}

export function tokenBucketRps(state: TokenBucketState, demandRps: number, rateRps: number, burst: number, ctx: ThroughputContext): number {
  if (advanced(state, ctx) && state.servedRps !== undefined) return state.servedRps;
  const dt = ctx.dt?.value ?? 1;
  const available = state.tokens + rateRps * dt;
  const served = Math.min(demandRps, available / dt);
  state.tokens = Math.min(burst, Math.max(0, available - served * dt));
  state.servedRps = served;
  state.tick = ctx.tick;
  return served;
}

export const model: ServiceModel<ApiGatewayConfig, TokenBucketState> = {
  defaults: APIGATEWAY_DEFAULTS,

  capacity(config) {
    const c = resolve(APIGATEWAY_DEFAULTS, config);
    return toMbps(quotaFor(c).rateRps, APIGATEWAY_ASSUMED.requestBytes);
  },

  newState(config) {
    return newTokenBucket(resolve(APIGATEWAY_DEFAULTS, config));
  },

  evaluate(config, state) {
    const c = resolve(APIGATEWAY_DEFAULTS, config);
    const { rateRps, burst } = quotaFor(c);
    return (ctx) => {
      const size = sizeOf(ctx, APIGATEWAY_ASSUMED.requestBytes);
      const demandRps = toRps(offeredMbps(ctx), size);
      const sustained = toMbps(rateRps, size);
      let capacity: Mbps = sustained;
      let bursting = false;
      if (state && ctx.dt !== undefined) {
        const served = tokenBucketRps(state, demandRps, rateRps, burst, ctx);
        bursting = served > rateRps;
        capacity = mbps(Math.max(sustained.value, toMbps(served, size).value));
      }
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(capacity),
        splitEven(ctx.outputCount),
        note(bursting && `burst bucket draining: ${Math.round(state?.tokens ?? 0).toLocaleString()} of ${burst.toLocaleString()} tokens left`),
        note(rateRps < c.rateLimitRps && `${c.region}: account quota capped at ${rateRps.toLocaleString()} rps`),
      );
    };
  },
};
