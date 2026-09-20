import { ModelTier, type Bytes, type CreditState, type Mbps, type ServiceModel } from "../../types/math";
import { bytes, cap, creditBucket, KiB, mbps, MiB, newCreditState, note, offered, offeredMbps, pipe, resolve, seconds, sizeOf, splitEven, toMbps } from "../utilities";

export enum PerformanceMode {
  GeneralPurpose = "General Purpose",
  MaxIO = "Max I/O",
}

export enum ThroughputMode {
  Elastic = "Elastic",
  Provisioned = "Provisioned",
  Bursting = "Bursting",
}

export interface EFSConfig {
  performanceMode?: PerformanceMode;
  throughputMode?: ThroughputMode;
  sizeGb?: number;
  provisionedMiBps?: number;
}

export const EFS_DEFAULTS: Required<EFSConfig> = {
  performanceMode: PerformanceMode.GeneralPurpose,
  throughputMode: ThroughputMode.Elastic,
  sizeGb: 100,
  provisionedMiBps: 256,
};

export const EFS_FIXED = {
  [ThroughputMode.Elastic]: { fsReadMiBps: 20 * 1024, perClientMiBps: 1500, readIops: 250_000 },
  [ThroughputMode.Provisioned]: { fsReadMiBps: 3 * 1024, perClientMiBps: 500, readIops: 55_000 },
  [ThroughputMode.Bursting]: { fsReadMiBps: 3 * 1024, perClientMiBps: 500, readIops: 35_000 },
  bursting: { baseMiBpsPerTiB: 50, minBaseMiBps: 1, burstMiBpsPerTiB: 100, minBurstMiBps: 100, bucketMiBPerTiB: 2.1 * MiB },
  readMeterFactor: 1 / 3,
  minMeteredBytes: 4000,
} as const;

export const EFS_ASSUMED = { opBytes: bytes(64 * KiB), readFraction: 0.8 } as const;

const miBpsToMbps = (m: number): number => (m * MiB * 8) / 1e6;

export const budgetFactor = (readFraction: number): number => 1 / (readFraction * EFS_FIXED.readMeterFactor + (1 - readFraction));

export interface FsLimits {
  baseline: Mbps;
  burst: Mbps;
  burstSeconds: number;
  perClient: Mbps;
  iopsCap: Mbps;
}

export function fsLimits(c: Required<EFSConfig>, op: Bytes): FsLimits {
  const mode = EFS_FIXED[c.throughputMode];
  const factor = budgetFactor(EFS_ASSUMED.readFraction);
  const metered = bytes(Math.max(op.value, EFS_FIXED.minMeteredBytes));
  const iopsCap = toMbps(mode.readIops, metered);
  const perClient = mbps(miBpsToMbps(mode.perClientMiBps));
  if (c.throughputMode === ThroughputMode.Bursting) {
    const b = EFS_FIXED.bursting;
    const tib = Math.max(0, c.sizeGb) / 1024;
    const base = Math.max(b.minBaseMiBps, b.baseMiBpsPerTiB * tib) * factor;
    const burst = Math.min(mode.fsReadMiBps, Math.max(b.minBurstMiBps, b.burstMiBpsPerTiB * tib) * factor);
    const bucketMiB = b.bucketMiBPerTiB * Math.max(1, tib);
    return { baseline: mbps(miBpsToMbps(base)), burst: mbps(miBpsToMbps(burst)), burstSeconds: burst > base ? bucketMiB / (burst - base) : 0, perClient, iopsCap };
  }
  const fs = c.throughputMode === ThroughputMode.Provisioned ? Math.min(mode.fsReadMiBps, c.provisionedMiBps * factor) : mode.fsReadMiBps;
  const capMbps = mbps(miBpsToMbps(fs));
  return { baseline: capMbps, burst: capMbps, burstSeconds: 0, perClient, iopsCap };
}

export const model: ServiceModel<EFSConfig, CreditState> = {
  defaults: EFS_DEFAULTS,

  capacity(config) {
    const l = fsLimits(resolve(EFS_DEFAULTS, config), EFS_ASSUMED.opBytes);
    return mbps(Math.min(l.burst.value, l.perClient.value, l.iopsCap.value));
  },

  newState(config) {
    const l = fsLimits(resolve(EFS_DEFAULTS, config), EFS_ASSUMED.opBytes);
    return newCreditState(l.baseline, l.burst, seconds(l.burstSeconds));
  },

  evaluate(config, state) {
    const c = resolve(EFS_DEFAULTS, config);
    return (ctx) => {
      const op = sizeOf(ctx, EFS_ASSUMED.opBytes);
      const l = fsLimits(c, op);
      const fs =
        state && ctx.dt !== undefined && l.burstSeconds > 0
          ? creditBucket({ baselineMbps: l.baseline, burstMbps: l.burst, demandMbps: offeredMbps(ctx), burstSeconds: seconds(l.burstSeconds), ctx }, state)
          : l.burst;
      const capacity = Math.min(fs.value, l.perClient.value, l.iopsCap.value);
      const bound = capacity === l.perClient.value ? "per-client" : capacity === l.iopsCap.value ? "IOPS" : "file-system";
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(mbps(capacity)),
        splitEven(ctx.outputCount),
        note(`${c.throughputMode}: ${bound} limit binds (${Math.round(capacity).toLocaleString()} Mbps)`),
        note(c.throughputMode === ThroughputMode.Bursting && fs.value === l.baseline.value && l.burst.value > l.baseline.value && `burst credits exhausted: ${c.sizeGb} GiB drives ${(l.baseline.value / 8 / MiB * 1e6).toFixed(0)} MiB/s baseline`),
        note(c.performanceMode === PerformanceMode.MaxIO && c.throughputMode === ThroughputMode.Elastic && "Max I/O is not supported with Elastic throughput"),
      );
    };
  },
};
