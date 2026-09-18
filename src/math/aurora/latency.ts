import { ModelTier, type LatencyModel } from "../../types/math";
import { current, mmc, ms, note, offeredMbps, pipe, resolve, sizeOf, start, tailMix, toRps } from "../utilities";
import { AURORA_ASSUMED, AURORA_DEFAULTS, resolveClass, type AuroraConfig, type AuroraState } from "./throughput";

// M/M/c per instance (c = vCPU · concurrencyPerVcpu, μ = 1000 / queryMs) on independent write and read pools.
// Replica lag is staleness, not latency.
// Spec: .references/reduced-formulas-latency.md §3.10

export const model: LatencyModel<AuroraConfig, AuroraState> = {
  defaults: AURORA_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(AURORA_DEFAULTS, config);
    const { readFraction, writerServesReads, queryMs, concurrencyPerVcpu } = AURORA_ASSUMED;
    const mu = 1000 / queryMs;
    const readServers = c.readers + (writerServesReads ? 1 : 0);
    return (ctx) => {
      const { cls, note: classNote } = resolveClass(c, current(state, ctx)?.level);
      const servers = cls.vcpu * concurrencyPerVcpu;
      const rps = toRps(offeredMbps(ctx), sizeOf(ctx, AURORA_ASSUMED.rowBytes));
      const write = mmc(rps * (1 - readFraction), mu, servers);
      const read = readServers > 0 ? mmc((rps * readFraction) / readServers, mu, servers) : mmc(rps * readFraction, mu, 0);
      const writeP99 = ms(queryMs + write.p99Ms.value);
      const readP99 = ms(queryMs + read.p99Ms.value);
      const p99 = tailMix([
        { share: 1 - readFraction, p99Ms: writeP99 },
        { share: readFraction, p99Ms: readP99 },
      ]);
      const connDemand = (rps * queryMs) / 1000;
      const maxConn = cls.maxConnections * (1 + c.readers);
      return pipe(
        start(ms(queryMs), ModelTier.Assumed),
        (r) => ({
          ...r,
          waitMs: ms(Math.max(write.p99Ms.value, read.p99Ms.value)),
          p50Ms: ms(queryMs + (1 - readFraction) * write.p50Ms.value + readFraction * read.p50Ms.value),
          p99Ms: p99,
          tailMs: p99,
          utilization: Math.max(write.rho, read.rho),
          servers,
        }),
        note(`writer ${cls.vcpu} vCPU × ${concurrencyPerVcpu} slots: ρ_write ${write.rho.toFixed(2)}, ρ_read ${read.rho.toFixed(2)} over ${readServers} read-serving instance(s); queryMs/concurrencyPerVcpu assumed`),
        note(classNote),
        note(connDemand > maxConn && `connection demand ${connDemand.toFixed(0)} > max_connections ${maxConn}: refused (see loss model)`),
        note((write.rho >= 1 || read.rho >= 1) && "pool overloaded: p99 unbounded (no engine-side throttle)"),
      );
    };
  },
};
