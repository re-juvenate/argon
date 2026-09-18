import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, mbps, note, pipe, ratio, startDrop } from "../utilities";
import { effectiveWeights, ROUTE53_DEFAULTS, type Route53Config } from "./throughput";

// Weighted sum of record drops; unhealthy records are already out of the split (steady state).
// Spec: .references/reduced-formulas-drop.md §3.9

export const model: DropModel<Route53Config> = {
  defaults: ROUTE53_DEFAULTS,

  evaluate(config) {
    return (ctx) => {
      const r = startDrop(ctx, mbps(Infinity), ModelTier.Measured);
      const weights = effectiveWeights(ctx.outputCount, config);
      const total = weights.reduce((acc, w) => acc + w, 0);
      const drops = ctx.downstreamDrop ?? [];
      const weighted = total > 0 ? drops.reduce((acc, d, i) => acc + ((weights[i] ?? 0) / total) * d.value, 0) : 0;
      return pipe(
        r,
        cause(DropKind.Downstream, ratio(weighted)),
        note(drops.length === 0 && "no downstream drops given: 0"),
        note("steady state: 90 s detection + TTL lag during an outage not modelled"),
      );
    };
  },
};
