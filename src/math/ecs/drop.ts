import { DropKind, ModelTier, type CreditState, type DropModel } from "../../types/math";
import { cause, mbps, note, pipe, resolve, startDrop } from "../utilities";
import { FARGATE_DEFAULTS, taskAvailableMbps, taskBaselineMbps, taskBurstMbps, type FargateConfig } from "./throughput";

// Overflow = 503 from overloaded tasks. Steady state: no scaling policy in config, so no scale-out lag.
// Spec: .references/reduced-formulas-drop.md §3.2

export const model: DropModel<FargateConfig, CreditState> = {
  defaults: FARGATE_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(FARGATE_DEFAULTS, config);
    const base = taskBaselineMbps(c.vcpu, c.memGiB).mbps;
    const burst = taskBurstMbps(c.vcpu, c.memGiB);
    return (ctx) => {
      const perTask = taskAvailableMbps(base, burst, state);
      const r = startDrop(ctx, mbps(c.tasks * perTask.value), ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Overflow, r.rawDrop),
        note(r.rawDrop.value > 0 && "tasks overloaded: 503s"),
        note(perTask.value < burst.value && "network credits exhausted: capacity at baseline"),
        note("steady state: scale-out lag (≈ 420 s to a healthy new task) not modelled without a scaling policy"),
      );
    };
  },
};
