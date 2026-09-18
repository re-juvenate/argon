import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, current, mbps, note, pipe, resolve, sizeOf, startDrop } from "../utilities";
import { EC2_ASSUMED } from "../ec2/throughput";
import { FARGATE_DEFAULTS, FARGATE_SCALING, taskAvailableMbps, taskBaselineMbps, taskBurstMbps, taskCapacityMbps, tasksInService, type FargateConfig, type FargateState } from "./throughput";

// Overflow = 503 from overloaded tasks; during scale-out the existing tasks absorb the spike.
// Spec: .references/reduced-formulas-drop.md §3.2

export const model: DropModel<FargateConfig, FargateState> = {
  defaults: FARGATE_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(FARGATE_DEFAULTS, config);
    const base = taskBaselineMbps(c.vcpu, c.memGiB).mbps;
    const burst = taskBurstMbps(c.vcpu, c.memGiB);
    return (ctx) => {
      const credits = current(state?.credits, ctx);
      const perTask = taskCapacityMbps(c, taskAvailableMbps(base, burst, credits), sizeOf(ctx, EC2_ASSUMED.avgBytes));
      const tasks = tasksInService(c, state, ctx);
      const pending = state?.scale.pending.length ?? 0;
      const r = startDrop(ctx, mbps(tasks * perTask.mbps.value), ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Overflow, r.rawDrop),
        note(r.rawDrop.value > 0 && (pending > 0 ? `tasks overloaded while scaling out (~${FARGATE_SCALING.delayUpS + FARGATE_SCALING.launchS} s to a healthy task): 503s` : "tasks overloaded: 503s")),
        note(perTask.mbps.value < burst.value && !perTask.cpuBound && "network credits exhausted: capacity at baseline"),
        note(state !== undefined && credits === undefined && "state not advanced this tick: steady state"),
      );
    };
  },
};
