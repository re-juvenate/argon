import { ModelTier, type Milliseconds, type Ratio, type ServiceModel } from "../../types/math";
import { mbps, ms, offered, pipe, ratio, resolve, splitEven } from "../utilities";
import interRegion from "./inter-region.json";

export interface RegionConfig {
  code?: string;
  azCount?: number;
  crossAzMs?: number;
  intraAzMs?: number;
  lambdaConcurrency?: number;
}

export const REGION_CODES = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-south-1",
  "sa-east-1",
] as const;

export type RegionCode = (typeof REGION_CODES)[number];

export const REGION_DEFAULTS: Required<RegionConfig> = { code: REGION_CODES[0], azCount: 3, crossAzMs: 1, intraAzMs: 0.1, lambdaConcurrency: 1000 };

export const REGION_ASSUMED = {
  internetMs: ms(30),
  internetLoss: ratio(0.001),
  interRegionLoss: ratio(0.0005),
  crossAzLoss: ratio(0),
} as const;

export const INTER_REGION_MS = interRegion.ms as Record<RegionCode, Partial<Record<RegionCode, number>>>;

export interface Placement {
  region?: Required<RegionConfig>;
  az?: number;
}

export const interRegionMs = (a: string, b: string): Milliseconds => ms(INTER_REGION_MS[a as RegionCode]?.[b as RegionCode] ?? REGION_ASSUMED.internetMs.value);

export function hopMs(from: Placement, to: Placement): Milliseconds {
  if (!from.region || !to.region) return from.region || to.region ? REGION_ASSUMED.internetMs : ms(0);
  if (from.region.code !== to.region.code) return interRegionMs(from.region.code, to.region.code);
  if (from.az !== undefined && to.az !== undefined) return ms(from.az === to.az ? from.region.intraAzMs : from.region.crossAzMs);
  const n = Math.max(1, from.region.azCount);
  return ms(from.region.intraAzMs / n + from.region.crossAzMs * (1 - 1 / n));
}

export function hopLoss(from: Placement, to: Placement): Ratio {
  if (!from.region || !to.region) return from.region || to.region ? REGION_ASSUMED.internetLoss : ratio(0);
  if (from.region.code !== to.region.code) return REGION_ASSUMED.interRegionLoss;
  return REGION_ASSUMED.crossAzLoss;
}

export const resolveRegion = (config?: RegionConfig): Required<RegionConfig> => resolve(REGION_DEFAULTS, config);

export function lambdaPoolShare(region: Required<RegionConfig>, reserved: readonly number[]): number {
  const taken = reserved.reduce((acc, r) => acc + Math.max(0, r), 0);
  const unreserved = reserved.filter((r) => r <= 0).length;
  return Math.max(0, region.lambdaConcurrency - taken) / Math.max(1, unreserved);
}

export const model: ServiceModel<RegionConfig> = {
  defaults: REGION_DEFAULTS,

  capacity() {
    return mbps(Infinity);
  },

  evaluate() {
    return (ctx) => pipe(offered(ctx, ModelTier.Assumed), splitEven(ctx.outputCount));
  },
};
