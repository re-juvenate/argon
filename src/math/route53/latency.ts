import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, pipe, resolve, start, tail, tailMix } from "../utilities";
import { ROUTE53_DEFAULTS, shares, type Route53Config, type Route53State } from "./throughput";

// Not in the data path (lookups amortized over TTL): p99 is the tail of the routed branches.
// Spec: .references/reduced-formulas-latency.md §3.9

export const model: LatencyModel<Route53Config, Route53State> = {
  defaults: ROUTE53_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(ROUTE53_DEFAULTS, config);
    return (ctx) => {
      const split = shares(c, state, ctx);
      const branches = ctx.downstreamMs?.map((p99Ms, i) => ({ share: split[i] ?? 0, p99Ms })) ?? [];
      return pipe(
        start(ms(0), ModelTier.Measured),
        (r) => (branches.length > 0 ? tail(tailMix(branches))(r) : r),
        note("DNS lookup amortized over TTL: no per-request latency"),
        note(branches.length === 0 && "no downstream tails given: p99 = 0"),
      );
    };
  },
};
