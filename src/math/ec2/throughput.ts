import { ModelTier, type CreditState, type Mbps, type ServiceModel } from "../../types/math";
import { cap, creditBucket, gbpsToMbps, mbps, newCreditState, note, num, offered, offeredMbps, parseCsv, pipe, resolve, seconds, splitEven, tier } from "../utilities";
import instanceCsv from "./instancetype.csv?raw";

// EC2 network throughput. The only thing you choose when launching is the instance type;
// bandwidth (baseline / burst) comes from AWS's spec sheet in instancetype.csv.
// Spec: .references/reduced-formulas-throughput.md §3.1

export interface EC2Config {
  instanceType?: string;
}

export const EC2_DEFAULTS: Required<EC2Config> = { instanceType: "t3.large" };

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

export interface InstanceSpec {
  instanceType: string;
  vcpu: number;
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

// Cap for traffic leaving through an internet gateway; derived from topology, not config.
export function internetCapMbps(spec: InstanceSpec): Mbps {
  return spec.vcpu < EC2_FIXED.internetCapVcpuThreshold
    ? EC2_FIXED.internetCapMbps
    : mbps(EC2_FIXED.internetCapShareAbove * spec.burstMbps.value);
}

export const model: ServiceModel<EC2Config, CreditState> = {
  defaults: EC2_DEFAULTS,

  // steady state: credits full
  capacity(config) {
    return resolveSpec(resolve(EC2_DEFAULTS, config).instanceType).burstMbps;
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
              { baselineMbps: base.mbps, burstMbps: spec.burstMbps, demandMbps: offeredMbps(ctx), burstSeconds: EC2_FIXED.burstSeconds, dt: ctx.dt },
              state,
            )
          : spec.burstMbps;
      const atBaseline = available.value === base.mbps.value && spec.burstMbps.value > base.mbps.value;
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(available),
        splitEven(ctx.outputCount),
        note(!INSTANCE_SPECS[instanceType] && `unknown instance type, using ${EC2_DEFAULTS.instanceType}`),
        note(base.estimated && "baseline estimated from vCPU (no CSV baseline)"),
        note(atBaseline && "network credits exhausted: at baseline"),
        tier(base.estimated ? ModelTier.Estimated : ModelTier.Measured),
      );
    };
  },
};
