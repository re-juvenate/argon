import { ModelTier, type CreditState, type LatencyModel } from "../../types/math";
import { mbps, ms, note, offeredMbps, pipe, resolve, start, wait } from "../utilities";
import { EC2_LATENCY_ASSUMED, linkQueue } from "../ec2/latency";
import { FARGATE_DEFAULTS, taskAvailableMbps, taskBaselineMbps, taskBurstMbps, type FargateConfig } from "./throughput";

// Each task is an independent M/M/1 link at λ / tasks.
// Spec: .references/reduced-formulas-latency.md §3.2

export const model: LatencyModel<FargateConfig, CreditState> = {
  defaults: FARGATE_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(FARGATE_DEFAULTS, config);
    const base = taskBaselineMbps(c.vcpu, c.memGiB);
    const burst = taskBurstMbps(c.vcpu, c.memGiB);
    return (ctx) => {
      const bw = taskAvailableMbps(base.mbps, burst, state);
      const perTask = mbps(offeredMbps(ctx).value / Math.max(1, c.tasks));
      const { xfer, queue } = linkQueue(perTask, bw);
      return pipe(
        start(ms(EC2_LATENCY_ASSUMED.processingMs.value + EC2_LATENCY_ASSUMED.nicMs.value + xfer.value), ModelTier.Estimated),
        wait(queue, 1),
        note(`processingMs ${EC2_LATENCY_ASSUMED.processingMs.value} and NIC latency assumed; per-task queue`),
        note("Fargate vCPU slower than EC2 for the same count (unsourced factor, not applied)"),
        note(bw.value < burst.value && "network credits exhausted: link at baseline"),
        note(queue.rho >= 1 && "task links overloaded: p99 unbounded"),
      );
    };
  },
};
