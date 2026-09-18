import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, combine, meanRatio, ms, note, pipe, ratio, resolve, startDrop, tailExceed } from "../utilities";
import { CLOUDFRONT_LATENCY_FIXED } from "./latency";
import { CLOUDFRONT_DEFAULTS, model as throughput, originShare, type CloudFrontConfig } from "./throughput";

// Quota throttle + origin errors and 504s, scaled by the origin share.
// Spec: .references/reduced-formulas-drop.md §3.8

export const model: DropModel<CloudFrontConfig> = {
  defaults: CLOUDFRONT_DEFAULTS,

  evaluate(config) {
    const c = resolve(CLOUDFRONT_DEFAULTS, config);
    const capacity = throughput.capacity(c);
    const share = originShare(c);
    return (ctx) => {
      const r = startDrop(ctx, capacity, ModelTier.Estimated);
      const originDrop = meanRatio(ctx.downstreamDrop);
      const originTail = ctx.downstreamMs && ctx.downstreamMs.length > 0 ? ms(Math.max(...ctx.downstreamMs.map((m) => m.value))) : undefined;
      const originTimeout = tailExceed(originTail, CLOUDFRONT_LATENCY_FIXED.originResponseTimeoutMs);
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
