import { ModelTier, type Bytes, type ServiceModel } from "../../types/math";
import { bytes, cap, KiB, mbps, note, offered, pipe, resolve, scaleOutputs, sizeOf, splitEven, toMbps } from "../utilities";

// CloudFront. At setup you choose whether Origin Shield is on; the per-distribution quotas
// (150 Gbps, 250,000 rps) are AWS's. Cache hit ratios are properties of the content, so
// they are fixed assumptions. The origin outputs carry only the miss share.
// Spec: .references/reduced-formulas-throughput.md §3.8

export interface CloudFrontConfig {
  originShield?: boolean;
}

export const CLOUDFRONT_DEFAULTS: Required<CloudFrontConfig> = { originShield: false };

export const CLOUDFRONT_FIXED = { dataTransferMbps: mbps(150_000), requestsPerSec: 250_000 } as const;

export const CLOUDFRONT_ASSUMED = {
  avgBytes: bytes(50 * KiB),
  hitPop: 0.9,
  hitRegional: 0.5,
  hitShield: 0.6,
  // PUT/POST/… and dynamic requests bypass every cache
  dynamicFraction: 0.1,
} as const;

export const capacityFor = (size: Bytes) => mbps(Math.min(CLOUDFRONT_FIXED.dataTransferMbps.value, toMbps(CLOUDFRONT_FIXED.requestsPerSec, size).value));

// Share of served viewer traffic that reaches the origin.
export function originShare(config?: CloudFrontConfig): number {
  const c = resolve(CLOUDFRONT_DEFAULTS, config);
  const a = CLOUDFRONT_ASSUMED;
  const missShield = c.originShield ? 1 - a.hitShield : 1;
  return a.dynamicFraction + (1 - a.dynamicFraction) * (1 - a.hitPop) * (1 - a.hitRegional) * missShield;
}

export const model: ServiceModel<CloudFrontConfig> = {
  defaults: CLOUDFRONT_DEFAULTS,

  capacity() {
    return capacityFor(CLOUDFRONT_ASSUMED.avgBytes);
  },

  // servedMbps = viewer-facing; outputsMbps = origin-facing
  evaluate(config) {
    const share = originShare(config);
    return (ctx) =>
      pipe(
        offered(ctx, ModelTier.Estimated),
        cap(capacityFor(sizeOf(ctx, CLOUDFRONT_ASSUMED.avgBytes))),
        splitEven(ctx.outputCount),
        scaleOutputs(share),
        note(`origin share ${(share * 100).toFixed(1)}% of served`),
      );
  },
};
