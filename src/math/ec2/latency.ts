import { ModelTier, type Bytes, type CreditState, type LatencyModel, type Mbps, type Milliseconds } from "../../types/math";
import { current, mmc, ms, note, num, offeredMbps, parseCsv, pipe, resolve, sizeOf, start, toRps, wait, xferMs, type QueueWait } from "../utilities";
import instanceCsv from "./instancetype.csv?raw";
import { baselineMbps, cpuServers, EC2_ASSUMED, EC2_DEFAULTS, resolveSpec, type EC2Config, type InstanceSpec } from "./throughput";

// M/M/c on the CPU threads and M/M/1 on the NIC; the wait comes from whichever is busier
// (same ρ as the throughput model).
// Spec: .references/reduced-formulas-latency.md §3.1

// efa_latency_microseconds, 0 = not published
const NIC_LATENCY_US: Record<string, number> = Object.fromEntries(parseCsv(instanceCsv).map((row) => [row.instance_type, num(row.efa_latency_microseconds, 0)]));

export function nicLatencyMs(instanceType: string): { ms: Milliseconds; measured: boolean } {
  const us = NIC_LATENCY_US[instanceType] ?? 0;
  return us > 0 ? { ms: ms(us / 1000), measured: true } : { ms: ms(EC2_ASSUMED.nicMs), measured: false };
}

// what the last tick granted; steady state = burst
export function availableMbps(spec: InstanceSpec, state?: CreditState): Mbps {
  return state?.availableMbps ?? (state !== undefined && state.creditsMbit <= 0 ? baselineMbps(spec).mbps : spec.burstMbps);
}

export interface InstanceQueue {
  xfer: Milliseconds;
  // the busier of link / cpu
  queue: QueueWait;
  servers: number;
  cpuBound: boolean;
}

// One instance: `demand` Mbps of `size` requests over `servers` CPU threads and a `bw` link.
export function instanceQueue(demand: Mbps, bw: Mbps, servers: number, size: Bytes, cpuEfficiency = 1): InstanceQueue {
  const xfer = xferMs(size, bw);
  const rps = toRps(demand, size);
  const link = mmc(rps, xfer.value > 0 ? 1000 / xfer.value : Infinity, 1);
  const cpu = mmc(rps, (1000 * cpuEfficiency) / EC2_ASSUMED.processingMs, servers);
  const cpuBound = cpu.rho >= link.rho;
  return { xfer, queue: cpuBound ? cpu : link, servers: cpuBound ? servers : 1, cpuBound };
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
      const q = instanceQueue(offeredMbps(ctx), bw, cpuServers(spec), sizeOf(ctx, EC2_ASSUMED.avgBytes));
      return pipe(
        start(ms(EC2_ASSUMED.processingMs + nic.ms.value + q.xfer.value), ModelTier.Estimated),
        wait(q.queue, q.servers),
        note(`processingMs ${EC2_ASSUMED.processingMs} assumed; ${q.cpuBound ? "CPU" : "link"} queue binds`),
        note(!nic.measured && "NIC latency assumed (no CSV figure)"),
        note(bw.value < spec.burstMbps.value && "network credits exhausted: link at baseline"),
        note(state !== undefined && s === undefined && "state not advanced this tick: steady state"),
        note(q.queue.rho >= 1 && "overloaded: p99 unbounded"),
      );
    };
  },
};
