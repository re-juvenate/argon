import { ModelTier, type Bytes, type CreditState, type Mbps, type ServiceModel } from "../../types/math";
import { bytes, cap, clamp, creditBucket, KiB, mbps, MiB, newCreditState, note, offered, offeredMbps, pipe, resolve, seconds, sizeOf, splitEven } from "../utilities";

export enum VolumeType {
  GP3 = "gp3",
  GP2 = "gp2",
  IO1 = "io1",
  IO2 = "io2",
  ST1 = "st1",
  SC1 = "sc1",
}

export interface EBSConfig {
  volumeType?: VolumeType;
  sizeGb?: number;
  iops?: number;
  throughputMiBps?: number;
}

export const EBS_DEFAULTS: Required<EBSConfig> = {
  volumeType: VolumeType.GP3,
  sizeGb: 100,
  iops: 3000,
  throughputMiBps: 125,
};

export const EBS_FIXED = {
  gp3: { baseIops: 3000, maxIops: 80_000, iopsPerGiB: 500, baseMiBps: 125, maxMiBps: 2000, miBpsPerIops: 0.25 },
  gp2: { iopsPerGiB: 3, minIops: 100, maxIops: 16_000, burstIops: 3000, credits: 5_400_000, smallMiBps: 128, smallGiB: 170, maxMiBps: 250 },
  io1: { iopsPerGiB: 50, maxIops: 64_000, lowIopsMaxMiBps: 500, lowIopsBytes: 256 * KiB, lowIopsCeiling: 32_000, highIopsBytes: 16 * KiB, maxMiBps: 1000 },
  io2: { iopsPerGiB: 1000, maxIops: 256_000, miBpsPerIops: 0.256, maxMiBps: 4000 },
  st1: { baseMiBpsPerTiB: 40, burstMiBpsPerTiB: 250, maxMiBps: 500, bucketMiBPerTiB: MiB, ioBytes: MiB },
  sc1: { baseMiBpsPerTiB: 12, burstMiBpsPerTiB: 80, maxBaseMiBps: 192, maxMiBps: 250, bucketMiBPerTiB: MiB, ioBytes: MiB },
} as const;

export const EBS_ASSUMED = { ioBytes: bytes(16 * KiB) } as const;

const miBpsToMbps = (m: number): number => (m * MiB * 8) / 1e6;
const iopsToMbps = (iops: number, io: Bytes): number => (iops * io.value * 8) / 1e6;

export interface VolumeLimits {
  baseline: Mbps;
  burst: Mbps;
  burstSeconds: number;
  iopsBound: boolean;
}

export function volumeLimits(c: Required<EBSConfig>, io: Bytes): VolumeLimits {
  const gib = Math.max(1, c.sizeGb);
  const tib = gib / 1024;
  const fixed = (iops: number, miBps: number): VolumeLimits => {
    const byIops = iopsToMbps(iops, io);
    const byBw = miBpsToMbps(miBps);
    const cap = mbps(Math.min(byIops, byBw));
    return { baseline: cap, burst: cap, burstSeconds: 0, iopsBound: byIops < byBw };
  };
  switch (c.volumeType) {
    case VolumeType.GP3: {
      const f = EBS_FIXED.gp3;
      const iops = clamp(c.iops, f.baseIops, Math.min(f.maxIops, f.iopsPerGiB * gib));
      const miBps = clamp(c.throughputMiBps, f.baseMiBps, Math.min(f.maxMiBps, f.miBpsPerIops * iops));
      return fixed(iops, miBps);
    }
    case VolumeType.GP2: {
      const f = EBS_FIXED.gp2;
      const base = clamp(f.iopsPerGiB * gib, f.minIops, f.maxIops);
      const burst = Math.max(base, f.burstIops);
      const miBps = gib <= f.smallGiB ? f.smallMiBps : f.maxMiBps;
      const bw = miBpsToMbps(miBps);
      const baseline = mbps(Math.min(iopsToMbps(base, io), bw));
      const burstMbps = mbps(Math.min(iopsToMbps(burst, io), bw));
      return { baseline, burst: burstMbps, burstSeconds: burst > base ? f.credits / (burst - base) : 0, iopsBound: iopsToMbps(burst, io) < bw };
    }
    case VolumeType.IO1: {
      const f = EBS_FIXED.io1;
      const iops = Math.min(c.iops, f.iopsPerGiB * gib, f.maxIops);
      const miBps = iops <= f.lowIopsCeiling ? Math.min(f.lowIopsMaxMiBps, (iops * f.lowIopsBytes) / MiB) : Math.min(f.maxMiBps, (iops * f.highIopsBytes) / MiB);
      return fixed(iops, miBps);
    }
    case VolumeType.IO2: {
      const f = EBS_FIXED.io2;
      const iops = Math.min(c.iops, f.iopsPerGiB * gib, f.maxIops);
      return fixed(iops, Math.min(f.maxMiBps, f.miBpsPerIops * iops));
    }
    case VolumeType.ST1:
    case VolumeType.SC1: {
      const f = c.volumeType === VolumeType.ST1 ? { ...EBS_FIXED.st1, maxBaseMiBps: EBS_FIXED.st1.maxMiBps } : EBS_FIXED.sc1;
      const base = Math.min(f.maxBaseMiBps, f.baseMiBpsPerTiB * tib);
      const burst = Math.min(f.maxMiBps, f.burstMiBpsPerTiB * tib);
      const bucketMiB = f.bucketMiBPerTiB * tib;
      return {
        baseline: mbps(miBpsToMbps(base)),
        burst: mbps(miBpsToMbps(burst)),
        burstSeconds: burst > base ? bucketMiB / (burst - base) : 0,
        iopsBound: false,
      };
    }
  }
}

export const model: ServiceModel<EBSConfig, CreditState> = {
  defaults: EBS_DEFAULTS,

  capacity(config) {
    return volumeLimits(resolve(EBS_DEFAULTS, config), EBS_ASSUMED.ioBytes).burst;
  },

  newState(config) {
    const l = volumeLimits(resolve(EBS_DEFAULTS, config), EBS_ASSUMED.ioBytes);
    return newCreditState(l.baseline, l.burst, seconds(l.burstSeconds));
  },

  evaluate(config, state) {
    const c = resolve(EBS_DEFAULTS, config);
    return (ctx) => {
      const io = sizeOf(ctx, EBS_ASSUMED.ioBytes);
      const l = volumeLimits(c, io);
      const available =
        state && ctx.dt !== undefined && l.burstSeconds > 0
          ? creditBucket({ baselineMbps: l.baseline, burstMbps: l.burst, demandMbps: offeredMbps(ctx), burstSeconds: seconds(l.burstSeconds), ctx }, state)
          : l.burst;
      const atBaseline = l.burst.value > l.baseline.value && available.value === l.baseline.value;
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(available),
        splitEven(ctx.outputCount),
        note(`${c.volumeType} ${c.sizeGb} GiB: ${l.iopsBound ? "IOPS-bound" : "throughput-bound"} at ${(io.value / KiB).toFixed(0)} KiB I/O`),
        note(atBaseline && "burst credits exhausted: at baseline"),
        note(c.iops > 32_000 && (c.volumeType === VolumeType.IO1 || c.volumeType === VolumeType.IO2) && "over 32,000 IOPS needs a Nitro instance"),
      );
    };
  },
};
