import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, pipe, start, tailMix } from "../utilities";
import { effectiveWeights, ROUTE53_DEFAULTS, type Route53Config } from "./throughput";

// Not in the data path (lookups amortized over TTL): p99 is the tail of the routed branches.
// Spec: .references/reduced-formulas-latency.md §3.9

export const model: LatencyModel<Route53Config> = {
  defaults: ROUTE53_DEFAULTS,

  evaluate(config) {
    return (ctx) => {
      const weights = effectiveWeights(ctx.outputCount, config);
      const total = weights.reduce((acc, w) => acc + w, 0);
      const branches = ctx.downstreamMs?.map((p99Ms, i) => ({ share: total > 0 ? weights[i] / total : 1 / weights.length, p99Ms })) ?? [];
      return pipe(
        start(ms(0), ModelTier.Measured),
        (r) => (branches.length > 0 ? { ...r, p99Ms: tailMix(branches) } : r),
        note("DNS lookup amortized over TTL: no per-request latency"),
        note(branches.length === 0 && "no downstream tails given: p99 = 0"),
      );
    };
  },
};
