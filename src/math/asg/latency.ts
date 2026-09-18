import { ModelTier, type LatencyModel } from "../../types/math";
import { mbps, ms, note, offeredMbps, pipe, resolve, start, wait } from "../utilities";
import { EC2_LATENCY_ASSUMED, linkQueue, nicLatencyMs } from "../ec2/latency";
import { resolveSpec } from "../ec2/throughput";
import { ASG_DEFAULTS, type ASGConfig } from "./throughput";

// n independent M/M/1 links at λ / n (instances keep their own queues, not one pooled M/M/n).
// Spec: .references/reduced-formulas-latency.md §3.3

export const model: LatencyModel<ASGConfig> = {
  defaults: ASG_DEFAULTS,

  evaluate(config) {
    const c = resolve(ASG_DEFAULTS, config);
    const spec = resolveSpec(c.instanceType);
    const nic = nicLatencyMs(spec.instanceType);
    return (ctx) => {
      const perInstance = mbps(offeredMbps(ctx).value / Math.max(1, c.inServiceCount));
      const { xfer, queue } = linkQueue(perInstance, spec.burstMbps);
      return pipe(
        start(ms(EC2_LATENCY_ASSUMED.processingMs.value + nic.ms.value + xfer.value), ModelTier.Estimated),
        wait(queue, 1),
        note(`${c.inServiceCount} independent instance queues at λ / n; processingMs assumed`),
        note(queue.rho >= 1 && "instance links overloaded: p99 unbounded"),
      );
    };
  },
};
