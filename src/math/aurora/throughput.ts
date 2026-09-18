import { ModelTier, type RampState, type ServiceModel, type ThroughputContext } from "../../types/math";
import { bytes, cap, newRampState, note, offered, offeredMbps, pipe, ramp, resolve, served, sizeOf, splitEven, toMbps, toRps, type RampSpec } from "../utilities";

// Aurora. At setup you choose the writer instance class (or a serverless ACU maximum) and how
// many readers. vCPU and max_connections come from AWS's class table; query cost and row
// size are properties of the application, so they are fixed assumptions.
// Spec: .references/reduced-formulas-throughput.md §3.10

export interface AuroraConfig {
  instanceClass?: string;
  // serverless v2 max capacity in ACU (2 GiB each); > 0 overrides instanceClass
  maxAcu?: number;
  minAcu?: number;
  readers?: number;
}

export const AURORA_DEFAULTS: Required<AuroraConfig> = { instanceClass: "db.r6g.large", maxAcu: 0, minAcu: 0.5, readers: 1 };

// serverless: current ACU
export type AuroraState = RampState;

export interface AuroraClass {
  vcpu: number;
  maxConnections: number;
}

// Aurora MySQL max_connections defaults (new-components doc §5.1)
export const AURORA_CLASSES: Record<string, AuroraClass> = {
  "db.t3.small": { vcpu: 2, maxConnections: 45 },
  "db.t3.medium": { vcpu: 2, maxConnections: 90 },
  "db.t3.large": { vcpu: 2, maxConnections: 135 },
  "db.t4g.medium": { vcpu: 2, maxConnections: 90 },
  "db.t4g.large": { vcpu: 2, maxConnections: 135 },
  "db.r6g.large": { vcpu: 2, maxConnections: 1000 },
  "db.r6g.xlarge": { vcpu: 4, maxConnections: 2000 },
  "db.r6g.2xlarge": { vcpu: 8, maxConnections: 3000 },
  "db.r6g.4xlarge": { vcpu: 16, maxConnections: 4000 },
  "db.r6g.8xlarge": { vcpu: 32, maxConnections: 5000 },
  "db.r6g.12xlarge": { vcpu: 48, maxConnections: 6000 },
  "db.r6g.16xlarge": { vcpu: 64, maxConnections: 6000 },
  "db.r7g.large": { vcpu: 2, maxConnections: 1000 },
  "db.r7g.xlarge": { vcpu: 4, maxConnections: 2000 },
  "db.r7g.2xlarge": { vcpu: 8, maxConnections: 3000 },
  "db.r7g.4xlarge": { vcpu: 16, maxConnections: 4000 },
  "db.r7g.8xlarge": { vcpu: 32, maxConnections: 5000 },
  "db.r7g.12xlarge": { vcpu: 48, maxConnections: 6000 },
  "db.r7g.16xlarge": { vcpu: 64, maxConnections: 6000 },
};

export const AURORA_ASSUMED = {
  readFraction: 0.8,
  writerServesReads: true,
  queryMs: 5,
  rowBytes: bytes(2048),
  // queries in flight per vCPU (IO-bound OLTP); qps per vCPU = concurrencyPerVcpu · 1000 / queryMs = 500
  concurrencyPerVcpu: 2.5,
  // serverless: r-class ratio of 8 GiB per vCPU → vCPU ≈ ACU / 4
  acuPerVcpu: 4,
} as const;

export const qpsPerVcpu = (): number => (AURORA_ASSUMED.concurrencyPerVcpu * 1000) / AURORA_ASSUMED.queryMs;

// serverless v2 scaling: 0.5-ACU steps, up fast, down after sustained low load (rates assumed)
export const AURORA_RAMP = { rateUpAcuPerS: 1, rateDownAcuPerS: 0.5 / 15, delayDownS: 900 } as const;

export function acuRamp(config?: AuroraConfig): RampSpec {
  const c = resolve(AURORA_DEFAULTS, config);
  return { floor: c.minAcu, ceiling: c.maxAcu, rateUp: AURORA_RAMP.rateUpAcuPerS, rateDown: AURORA_RAMP.rateDownAcuPerS, delayUpS: 0, delayDownS: AURORA_RAMP.delayDownS, launchS: 0, cooldownS: 0 };
}

// max_connections = GREATEST(log2(mem/805306368)*45, log2(mem/8187281408)*1000, 45), mem = acu × 2 GiB
export function serverlessClass(acu: number): AuroraClass {
  const mem = acu * 2 * 1024 ** 3;
  const maxConnections = Math.floor(Math.max(Math.log2(mem / 805306368) * 45, Math.log2(mem / 8187281408) * 1000, 45));
  return { vcpu: acu / AURORA_ASSUMED.acuPerVcpu, maxConnections };
}

// `acu` overrides maxAcu for the serverless class (current capacity from AuroraState)
export function resolveClass(config?: AuroraConfig, acu?: number): { cls: AuroraClass; note?: string } {
  const c = resolve(AURORA_DEFAULTS, config);
  if (c.maxAcu > 0) return { cls: serverlessClass(acu ?? c.maxAcu), note: "serverless: vCPU ≈ ACU / 4 (assumed)" };
  const cls = AURORA_CLASSES[c.instanceClass];
  if (cls) return { cls };
  return { cls: AURORA_CLASSES[AURORA_DEFAULTS.instanceClass], note: `unknown class ${c.instanceClass}, using ${AURORA_DEFAULTS.instanceClass}` };
}

export function instanceRps(cls: AuroraClass): number {
  return Math.min(cls.vcpu * qpsPerVcpu(), (cls.maxConnections * 1000) / AURORA_ASSUMED.queryMs);
}

export function capacityRps(config?: AuroraConfig, acu?: number): { writeRps: number; readRps: number } {
  const { cls } = resolveClass(config, acu);
  const per = instanceRps(cls);
  const readers = resolve(AURORA_DEFAULTS, config).readers;
  return { writeRps: per, readRps: (AURORA_ASSUMED.writerServesReads ? per : 0) + readers * per };
}

// serverless: ACU the current tick runs at (ramping toward demand); provisioned: undefined
export function currentAcu(config: Required<AuroraConfig>, state: AuroraState | undefined, demandRps: number, ctx: ThroughputContext): number | undefined {
  if (config.maxAcu <= 0) return undefined;
  if (state === undefined) return config.maxAcu;
  // ACU needed so that the work pool is at ~70 % utilization (assumed target)
  const perAcuRps = instanceRps(serverlessClass(1));
  const desired = demandRps / (perAcuRps * 0.7);
  return ramp(state, desired, acuRamp(config), ctx);
}

export const model: ServiceModel<AuroraConfig, AuroraState> = {
  defaults: AURORA_DEFAULTS,

  capacity(config) {
    const c = capacityRps(config);
    return toMbps(c.writeRps + c.readRps, AURORA_ASSUMED.rowBytes);
  },

  newState(config) {
    return newRampState(resolve(AURORA_DEFAULTS, config).minAcu);
  },

  evaluate(config, state) {
    const { readFraction } = AURORA_ASSUMED;
    const c = resolve(AURORA_DEFAULTS, config);
    return (ctx) => {
      const rowBytes = sizeOf(ctx, AURORA_ASSUMED.rowBytes);
      const offeredRps = toRps(offeredMbps(ctx), rowBytes);
      const perInstanceShare = 1 / (1 + c.readers);
      const acu = currentAcu(c, state, offeredRps * Math.max(1 - readFraction, readFraction * perInstanceShare), ctx);
      const { cls, note: classNote } = resolveClass(c, acu);
      const cap_ = capacityRps(c, acu);
      // reads and writes saturate independently
      const servedRps = Math.min(offeredRps * (1 - readFraction), cap_.writeRps) + Math.min(offeredRps * readFraction, cap_.readRps);
      return pipe(
        offered(ctx, ModelTier.Assumed),
        cap(toMbps(cap_.writeRps + cap_.readRps, rowBytes)),
        served(toMbps(servedRps, rowBytes)),
        splitEven(ctx.outputCount),
        note(`writer ${cls.vcpu} vCPU / ${cls.maxConnections} conn; concurrencyPerVcpu / queryMs assumed`),
        note(classNote),
        note(acu !== undefined && state !== undefined && `serverless at ${acu.toFixed(1)} ACU (min ${c.minAcu}, max ${c.maxAcu}); ramp rates assumed`),
      );
    };
  },
};
