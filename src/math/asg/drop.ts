import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, pipe, ratio, resolve, startDrop } from "../utilities";
import { spotFloor } from "../ec2/drop";
import { ASG_DEFAULTS, model as throughput, type ASGConfig } from "./throughput";

// n × EC2 overflow (credits full) plus the Spot floor.
// Spec: .references/reduced-formulas-drop.md §3.3

export const model: DropModel<ASGConfig> = {
  defaults: ASG_DEFAULTS,

  evaluate(config) {
    const c = resolve(ASG_DEFAULTS, config);
    const capacity = throughput.capacity(c);
    const spot = spotFloor(c.plan);
    return (ctx) => {
      const r = startDrop(ctx, capacity, ModelTier.Estimated);
      return pipe(
        r,
        cause(DropKind.Overflow, r.rawDrop),
        cause(DropKind.Reclaimed, ratio(spot)),
        note(r.rawDrop.value > 0 && `${c.inServiceCount} instance(s) overloaded`),
        note("steady state: scale-out lag not modelled without a scaling policy"),
      );
    };
  },
};
