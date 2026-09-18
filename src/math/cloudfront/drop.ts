import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, combine, meanRatio, note, pipe, ratio, resolve, sizeOf, startDrop, tailExceed } from "../utilities";
import { CLOUDFRONT_LATENCY_FIXED } from "./latency";
import { capacityFor, CLOUDFRONT_ASSUMED, CLOUDFRONT_DEFAULTS, originShare, type CloudFrontConfig } from "./throughput";

// Quota throttle + origin errors and 504s, scaled by the origin share.
// Spec: .references/reduced-formulas-drop.md §3.8

export const model: DropModel<CloudFrontConfig> = {
  defaults: CLOUDFRONT_DEFAULTS,

  evaluate(config) {
    const c = resolve(CLOUDFRONT_DEFAULTS, config);
    const share = originShare(c);
    return (ctx) => {
      const r = startDrop(ctx, capacityFor(sizeOf(ctx, CLOUDFRONT_ASSUMED.avgBytes)), ModelTier.Estimated);
      // origins share the miss traffic evenly: mean over origins for both terms
      const originDrop = meanRatio(ctx.downstreamDrop);
      const originTimeout = meanRatio(ctx.downstreamMs?.map((m) => tailExceed(m, CLOUDFRONT_LATENCY_FIXED.originResponseTimeoutMs)));
      const origin = combine([originDrop, originTimeout]);
      return pipe(
        r,
        cause(DropKind.Throttle, r.rawDrop),
        cause(DropKind.Downstream, ratio(share * originDrop.value)),
        cause(DropKind.Timeout, ratio(share * originTimeout.value)),
        note(r.rawDrop.value > 0 && "distribution quota exceeded: throttled at the edge"),
        note(origin.value > 0 && `origin loss ${(origin.value * 100).toFixed(1)}% × origin share ${(share * 100).toFixed(1)}%`),
        note(ctx.downstreamDrop === undefined && "origin drop unknown: 0"),
        note("stale-if-error / origin groups not in config: not applied"),
      );
    };
  },
};
