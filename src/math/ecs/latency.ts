import { ModelTier, type LatencyModel } from "../../types/math";
import { current, mbps, ms, note, offeredMbps, pipe, resolve, sizeOf, start, wait } from "../utilities";
import { instanceQueue } from "../ec2/latency";
import { EC2_ASSUMED } from "../ec2/throughput";
import { FARGATE_CPU_EFFICIENCY, FARGATE_DEFAULTS, taskAvailableMbps, taskBaselineMbps, taskBurstMbps, tasksInService, type FargateConfig, type FargateState } from "./throughput";

// Each task is an independent queue at λ / tasks: M/M/c on its vCPUs, M/M/1 on its link.
// Spec: .references/reduced-formulas-latency.md §3.2

export const model: LatencyModel<FargateConfig, FargateState> = {
  defaults: FARGATE_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(FARGATE_DEFAULTS, config);
    const base = taskBaselineMbps(c.vcpu, c.memGiB);
    const burst = taskBurstMbps(c.vcpu, c.memGiB);
    return (ctx) => {
      const credits = current(state?.credits, ctx);
      const bw = taskAvailableMbps(base.mbps, burst, credits);
      const tasks = Math.max(1, tasksInService(c, state, ctx));
      const q = instanceQueue(mbps(offeredMbps(ctx).value / tasks), bw, c.vcpu, sizeOf(ctx, EC2_ASSUMED.avgBytes), FARGATE_CPU_EFFICIENCY);
      return pipe(
        start(ms(EC2_ASSUMED.processingMs + EC2_ASSUMED.nicMs + q.xfer.value), ModelTier.Estimated),
        wait(q.queue, q.servers),
        note(`${tasks} task queue(s); processingMs and NIC latency assumed; ${q.cpuBound ? "CPU" : "link"} binds`),
        note(bw.value < burst.value && "network credits exhausted: link at baseline"),
        note(state !== undefined && credits === undefined && "state not advanced this tick: steady state"),
        note(q.queue.rho >= 1 && "tasks overloaded: p99 unbounded"),
      );
    };
  },
};
