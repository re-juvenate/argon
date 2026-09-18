import { ModelTier, type Bytes, type CreditState, type Mbps, type ServiceModel } from "../../types/math";
import { bytes, cap, creditBucket, gbpsToMbps, KiB, mbps, newCreditState, note, num, offered, offeredMbps, parseCsv, pipe, resolve, seconds, sizeOf, splitEven, tier, toMbps } from "../utilities";
import instanceCsv from "./instancetype.csv?raw";

// EC2 throughput: the NIC (baseline / burst from instancetype.csv) or the CPU (vCPU × an
// assumed per-request processing time), whichever binds for the request size.
// Spec: .references/reduced-formulas-throughput.md §3.1

export interface EC2Config {
  instanceType?: string;
  // key into plantype.csv
  plan?: string;
}

export const EC2_DEFAULTS: Required<EC2Config> = { instanceType: "t3.large", plan: "On-Demand" };

// Fixed by AWS (aws-simulation-research.md §1.1)
export const EC2_FIXED = {
  // burst lasts "typically from 5 to 60 minutes"; midpoint
  burstSeconds: seconds(1800),
  internetCapMbps: mbps(5000),
  internetCapVcpuThreshold: 32,
  internetCapShareAbove: 0.5,
  singleFlowMbps: mbps(5000),
  // non-T families scale baseline ~linearly with vCPU up to the 32-vCPU size
  sustainedVcpu: 32,
} as const;

// application side (not something AWS asks for)
export const EC2_ASSUMED = {
  avgBytes: bytes(50 * KiB),
  // CPU time per request on one thread
  processingMs: 5,
  nicMs: 0.1,
} as const;

export interface InstanceSpec {
  instanceType: string;
  vcpu: number;
  threadsPerVcpu: number;
  memGiB: number;
  burstMbps: Mbps;
  // value NaN when the CSV row has no baseline
  baselineMbps: Mbps;
}

export const INSTANCE_SPECS: Record<string, InstanceSpec> = Object.fromEntries(
  parseCsv(instanceCsv).map((row) => {
    const spec: InstanceSpec = {
      instanceType: row.instance_type,
      vcpu: num(row.vcpu),
      threadsPerVcpu: num(row.threads_per_vcpu, 1),
      memGiB: num(row.mem_gib),
      burstMbps: gbpsToMbps(num(row.network_bandwidth_gbps)),
      baselineMbps: gbpsToMbps(num(row.baseline_bandwidth_gbps)),
    };
    return [spec.instanceType, spec];
  }),
);

export function resolveSpec(instanceType: string = EC2_DEFAULTS.instanceType): InstanceSpec {
  return INSTANCE_SPECS[instanceType] ?? INSTANCE_SPECS[EC2_DEFAULTS.instanceType];
}

export function baselineMbps(spec: InstanceSpec): { mbps: Mbps; estimated: boolean } {
  if (Number.isFinite(spec.baselineMbps.value)) return { mbps: spec.baselineMbps, estimated: false };
  if (spec.vcpu >= EC2_FIXED.sustainedVcpu) return { mbps: spec.burstMbps, estimated: true };
  return { mbps: mbps(Math.min(spec.burstMbps.value, (spec.burstMbps.value * spec.vcpu) / EC2_FIXED.sustainedVcpu)), estimated: true };
}

// request-serving threads and their rate (M/M/c servers for the latency model)
export const cpuServers = (spec: InstanceSpec): number => spec.vcpu * spec.threadsPerVcpu;
export const cpuRps = (spec: InstanceSpec): number => (cpuServers(spec) * 1000) / EC2_ASSUMED.processingMs;
export const cpuCapacityMbps = (spec: InstanceSpec, size: Bytes): Mbps => toMbps(cpuRps(spec), size);

// Cap for traffic leaving through an internet gateway; derived from topology, not config.
export function internetCapMbps(spec: InstanceSpec): Mbps {
  return spec.vcpu < EC2_FIXED.internetCapVcpuThreshold
    ? EC2_FIXED.internetCapMbps
    : mbps(EC2_FIXED.internetCapShareAbove * spec.burstMbps.value);
}

export const model: ServiceModel<EC2Config, CreditState> = {
  defaults: EC2_DEFAULTS,

  // steady state: credits full, default request size
  capacity(config) {
    const spec = resolveSpec(resolve(EC2_DEFAULTS, config).instanceType);
    return mbps(Math.min(spec.burstMbps.value, cpuCapacityMbps(spec, EC2_ASSUMED.avgBytes).value));
  },

  newState(config) {
    const spec = resolveSpec(resolve(EC2_DEFAULTS, config).instanceType);
    return newCreditState(baselineMbps(spec).mbps, spec.burstMbps, EC2_FIXED.burstSeconds);
  },

  evaluate(config, state) {
    const { instanceType } = resolve(EC2_DEFAULTS, config);
    const spec = resolveSpec(instanceType);
    const base = baselineMbps(spec);
    return (ctx) => {
      const available =
        state && ctx.dt !== undefined
          ? creditBucket(
              { baselineMbps: base.mbps, burstMbps: spec.burstMbps, demandMbps: offeredMbps(ctx), burstSeconds: EC2_FIXED.burstSeconds, ctx },
              state,
            )
          : spec.burstMbps;
      const atBaseline = available.value === base.mbps.value && spec.burstMbps.value > base.mbps.value;
      const cpu = cpuCapacityMbps(spec, sizeOf(ctx, EC2_ASSUMED.avgBytes));
      const cpuBound = cpu.value < available.value;
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(cpuBound ? cpu : available),
        splitEven(ctx.outputCount),
        note(!INSTANCE_SPECS[instanceType] && `unknown instance type, using ${EC2_DEFAULTS.instanceType}`),
        note(base.estimated && "baseline estimated from vCPU (no CSV baseline)"),
        note(atBaseline && "network credits exhausted: at baseline"),
        note(cpuBound && `CPU-bound: ${cpuServers(spec)} threads × ${EC2_ASSUMED.processingMs} ms/request (assumed) = ${cpuRps(spec).toFixed(0)} rps`),
        tier(cpuBound ? ModelTier.Assumed : base.estimated ? ModelTier.Estimated : ModelTier.Measured),
      );
    };
  },
};
