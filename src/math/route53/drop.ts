import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, mbps, note, pipe, ratio, resolve, startDrop } from "../utilities";
import { ROUTE53_DEFAULTS, shares, type Route53Config, type Route53State } from "./throughput";

// Weighted sum of record drops over the split clients actually see (detection + TTL lag).
// Spec: .references/reduced-formulas-drop.md §3.9

export const model: DropModel<Route53Config, Route53State> = {
  defaults: ROUTE53_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(ROUTE53_DEFAULTS, config);
    return (ctx) => {
      const r = startDrop(ctx, mbps(Infinity), ModelTier.Measured);
      const split = shares(c, state, ctx);
      const drops = ctx.downstreamDrop ?? [];
      const weighted = drops.reduce((acc, d, i) => acc + (split[i] ?? 0) * d.value, 0);
      return pipe(
        r,
        cause(DropKind.Downstream, ratio(weighted)),
        note(drops.length === 0 && "no downstream drops given: 0"),
        note(state === undefined && "steady state: detection + TTL lag not applied"),
      );
    };
  },
};
