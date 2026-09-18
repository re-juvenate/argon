import { ModelTier, type LatencyModel } from "../../types/math";
import { mmc, ms, note, offeredMbps, pipe, resolve, start, tailMix, toRps } from "../utilities";
import { AURORA_ASSUMED, AURORA_DEFAULTS, resolveClass, type AuroraConfig } from "./throughput";

// M/M/c per instance (c = vCPU, μ = qpsPerVcpu) on independent write and read pools.
// Replica lag is staleness, not latency.
// Spec: .references/reduced-formulas-latency.md §3.10

export const model: LatencyModel<AuroraConfig> = {
  defaults: AURORA_DEFAULTS,

  evaluate(config) {
    const c = resolve(AURORA_DEFAULTS, config);
    const { cls, note: classNote } = resolveClass(c);
    const { readFraction, writerServesReads, queryMs, qpsPerVcpu, rowBytes } = AURORA_ASSUMED;
    const readServers = c.readers + (writerServesReads ? 1 : 0);
    return (ctx) => {
      const rps = toRps(offeredMbps(ctx), rowBytes);
      const write = mmc(rps * (1 - readFraction), qpsPerVcpu, cls.vcpu);
      const read = readServers > 0 ? mmc((rps * readFraction) / readServers, qpsPerVcpu, cls.vcpu) : mmc(rps * readFraction, qpsPerVcpu, 0);
      const writeP99 = ms(queryMs + write.p99Ms.value);
      const readP99 = ms(queryMs + read.p99Ms.value);
      const connDemand = (rps * queryMs) / 1000;
      const maxConn = cls.maxConnections * (1 + c.readers);
      return pipe(
        start(ms(queryMs), ModelTier.Assumed),
        (r) => ({
          ...r,
          waitMs: ms(Math.max(write.p99Ms.value, read.p99Ms.value)),
          p50Ms: ms(queryMs + (1 - readFraction) * write.p50Ms.value + readFraction * read.p50Ms.value),
          p99Ms: tailMix([
            { share: 1 - readFraction, p99Ms: writeP99 },
            { share: readFraction, p99Ms: readP99 },
          ]),
          utilization: Math.max(write.rho, read.rho),
          servers: cls.vcpu,
        }),
        note(`writer ${cls.vcpu} vCPU: ρ_write ${write.rho.toFixed(2)}, ρ_read ${read.rho.toFixed(2)} over ${readServers} read-serving instance(s); queryMs/qpsPerVcpu assumed`),
        note(classNote),
        note(connDemand > maxConn && `connection demand ${connDemand.toFixed(0)} > max_connections ${maxConn}: refused (see loss model)`),
        note((write.rho >= 1 || read.rho >= 1) && "pool overloaded: p99 unbounded (no engine-side throttle)"),
      );
    };
  },
};
