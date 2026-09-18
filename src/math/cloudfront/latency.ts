import { ModelTier, type LatencyModel } from "../../types/math";
import { capTimeout, mix, ms, note, pipe, resolve, start, tailMix } from "../utilities";
import { CLOUDFRONT_ASSUMED, CLOUDFRONT_DEFAULTS, originShare, type CloudFrontConfig } from "./throughput";

// Mixture over POP hit / regional hit / origin; the origin branch (≈ 14.5 % by default) carries
// the downstream tail, so it is the p99. No store-and-forward delay.
// Spec: .references/reduced-formulas-latency.md §3.8

export const CLOUDFRONT_LATENCY_FIXED = {
  // docs default (1–120 s)
  originResponseTimeoutMs: ms(30_000),
} as const;

export const CLOUDFRONT_LATENCY_ASSUMED = {
  // observed 20–70 ms
  edgeRttMs: ms(40),
  popToRegionalMs: ms(10),
  originHopMs: ms(10),
} as const;

export const model: LatencyModel<CloudFrontConfig> = {
  defaults: CLOUDFRONT_DEFAULTS,

  evaluate(config) {
    const c = resolve(CLOUDFRONT_DEFAULTS, config);
    const a = CLOUDFRONT_ASSUMED;
    const l = CLOUDFRONT_LATENCY_ASSUMED;
    const cacheable = 1 - a.dynamicFraction;
    const hitShare = cacheable * a.hitPop;
    const regionalShare = cacheable * (1 - a.hitPop) * a.hitRegional;
    const origin = originShare(c);
    const hit = ms(l.edgeRttMs.value);
    const regional = ms(l.edgeRttMs.value + l.popToRegionalMs.value);
    const originOwn = l.edgeRttMs.value + l.popToRegionalMs.value + l.originHopMs.value;
    return (ctx) => {
      const origins = ctx.downstreamMs;
      const originTail = origins && origins.length > 0 ? tailMix(origins.map((p99Ms) => ({ share: 1 / origins.length, p99Ms }))).value : 0;
      const originP99 = ms(Math.min(originOwn + originTail, originOwn + CLOUDFRONT_LATENCY_FIXED.originResponseTimeoutMs.value));
      return pipe(
        start(hit, ModelTier.Estimated),
        mix([
          { share: hitShare, p50Ms: hit, p99Ms: hit },
          { share: regionalShare, p50Ms: regional, p99Ms: regional },
          // only p99 is known downstream
          { share: origin, p50Ms: ms(originOwn), p99Ms: originP99 },
        ]),
        capTimeout(ms(originOwn + CLOUDFRONT_LATENCY_FIXED.originResponseTimeoutMs.value)),
        note(`shares: POP hit ${(hitShare * 100).toFixed(1)}%, regional ${(regionalShare * 100).toFixed(1)}%, origin ${(origin * 100).toFixed(1)}%${c.originShield ? " (Origin Shield)" : ""}`),
        note(origins === undefined && origin >= 0.01 && "origin tail unknown: p99 covers the CloudFront part only"),
        note("edge RTT 40 ms, POP→regional 10 ms, origin hop 10 ms assumed"),
      );
    };
  },
};
