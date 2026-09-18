import { ModelTier, type CreditState, type LatencyModel, type Mbps, type Milliseconds } from "../../types/math";
import { bytes, current, KiB, mmc, ms, note, num, offeredMbps, parseCsv, pipe, resolve, start, toRps, wait, xferMs, type QueueWait } from "../utilities";
import instanceCsv from "./instancetype.csv?raw";
import { baselineMbps, EC2_DEFAULTS, resolveSpec, type EC2Config, type InstanceSpec } from "./throughput";

// M/M/1 on the NIC (same ρ as the throughput model) plus an assumed processing time.
// Spec: .references/reduced-formulas-latency.md §3.1

export const EC2_LATENCY_ASSUMED = {
  avgBytes: bytes(50 * KiB),
  processingMs: ms(5),
  nicMs: ms(0.1),
} as const;

// efa_latency_microseconds, 0 = not published
const NIC_LATENCY_US: Record<string, number> = Object.fromEntries(parseCsv(instanceCsv).map((row) => [row.instance_type, num(row.efa_latency_microseconds, 0)]));

export function nicLatencyMs(instanceType: string): { ms: Milliseconds; measured: boolean } {
  const us = NIC_LATENCY_US[instanceType] ?? 0;
  return us > 0 ? { ms: ms(us / 1000), measured: true } : { ms: EC2_LATENCY_ASSUMED.nicMs, measured: false };
}

// what the last tick granted; steady state = burst
export function availableMbps(spec: InstanceSpec, state?: CreditState): Mbps {
  return state?.availableMbps ?? (state !== undefined && state.creditsMbit <= 0 ? baselineMbps(spec).mbps : spec.burstMbps);
}

export function linkQueue(demand: Mbps, bw: Mbps, avgBytes = EC2_LATENCY_ASSUMED.avgBytes): { xfer: Milliseconds; queue: QueueWait } {
  const xfer = xferMs(avgBytes, bw);
  const mu = xfer.value > 0 ? 1000 / xfer.value : Infinity;
  return { xfer, queue: mmc(toRps(demand, avgBytes), mu, 1) };
}

export const model: LatencyModel<EC2Config, CreditState> = {
  defaults: EC2_DEFAULTS,

  evaluate(config, state) {
    const { instanceType } = resolve(EC2_DEFAULTS, config);
    const spec = resolveSpec(instanceType);
    const nic = nicLatencyMs(spec.instanceType);
    return (ctx) => {
      const s = current(state, ctx);
      const bw = availableMbps(spec, s);
      const { xfer, queue } = linkQueue(offeredMbps(ctx), bw);
      return pipe(
        start(ms(EC2_LATENCY_ASSUMED.processingMs.value + nic.ms.value + xfer.value), ModelTier.Estimated),
        wait(queue, 1),
        note(`processingMs ${EC2_LATENCY_ASSUMED.processingMs.value} assumed`),
        note(!nic.measured && "NIC latency assumed (no CSV figure)"),
        note(bw.value < spec.burstMbps.value && "network credits exhausted: link at baseline"),
        note(state !== undefined && s === undefined && "state not advanced this tick: steady state"),
        note(queue.rho >= 1 && "link overloaded: p99 unbounded"),
      );
    };
  },
};
