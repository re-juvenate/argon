import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, current, mbps, note, pipe, ratio, resolve, startDrop } from "../utilities";
import { spotFloor } from "../ec2/drop";
import { availableMbps } from "../ec2/latency";
import { resolveSpec } from "../ec2/throughput";
import { ASG_DEFAULTS, ASG_SCALING, instanceCapacityMbps, instancesInService, type ASGConfig, type ASGState } from "./throughput";

// n × per-instance overflow plus the Spot floor; during scale-out the existing instances absorb the spike.
// Spec: .references/reduced-formulas-drop.md §3.3

export const model: DropModel<ASGConfig, ASGState> = {
  defaults: ASG_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(ASG_DEFAULTS, config);
    const spec = resolveSpec(c.instanceType);
    const spot = spotFloor(c.plan);
    return (ctx) => {
      const credits = current(state?.credits, ctx);
      const per = instanceCapacityMbps(spec, availableMbps(spec, credits), ctx);
      const n = instancesInService(c, state, ctx);
      const pending = state?.scale.pending.length ?? 0;
      const r = startDrop(ctx, mbps(n * per.mbps.value), ModelTier.Estimated);
      return pipe(
        r,
        cause(DropKind.Overflow, r.rawDrop),
        cause(DropKind.Reclaimed, ratio(spot)),
        note(r.rawDrop.value > 0 && (pending > 0 ? `${n} instance(s) overloaded while scaling out (~${ASG_SCALING.delayUpS + ASG_SCALING.launchS} s to in-service)` : `${n} instance(s) overloaded`)),
        note(state !== undefined && credits === undefined && "state not advanced this tick: steady state"),
      );
    };
  },
};
