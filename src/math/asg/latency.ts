import { ModelTier, type LatencyModel } from "../../types/math";
import { current, mbps, ms, note, offeredMbps, pipe, resolve, sizeOf, start, wait } from "../utilities";
import { availableMbps, instanceQueue, nicLatencyMs } from "../ec2/latency";
import { cpuServers, EC2_ASSUMED, resolveSpec } from "../ec2/throughput";
import { ASG_DEFAULTS, instancesInService, type ASGConfig, type ASGState } from "./throughput";

// n independent instance queues at λ / n (not one pooled M/M/n).
// Spec: .references/reduced-formulas-latency.md §3.3

export const model: LatencyModel<ASGConfig, ASGState> = {
  defaults: ASG_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(ASG_DEFAULTS, config);
    const spec = resolveSpec(c.instanceType);
    const nic = nicLatencyMs(spec.instanceType);
    return (ctx) => {
      const credits = current(state?.credits, ctx);
      const bw = availableMbps(spec, credits);
      const n = Math.max(1, instancesInService(c, state, ctx));
      const q = instanceQueue(mbps(offeredMbps(ctx).value / n), bw, cpuServers(spec), sizeOf(ctx, EC2_ASSUMED.avgBytes));
      return pipe(
        start(ms(EC2_ASSUMED.processingMs + nic.ms.value + q.xfer.value), ModelTier.Estimated),
        wait(q.queue, q.servers),
        note(`${n} independent instance queues at λ / n; processingMs assumed; ${q.cpuBound ? "CPU" : "link"} binds`),
        note(bw.value < spec.burstMbps.value && "network credits exhausted: link at baseline"),
        note(state !== undefined && credits === undefined && "state not advanced this tick: steady state"),
        note(q.queue.rho >= 1 && "instances overloaded: p99 unbounded"),
      );
    };
  },
};
