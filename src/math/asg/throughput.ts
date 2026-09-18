import { ModelTier, type CreditState, type Mbps, type RampState, type ServiceModel, type ThroughputContext } from "../../types/math";
import { cap, creditBucket, mbps, newCreditState, newRampState, note, offered, offeredMbps, pipe, ramp, resolve, sizeOf, splitEven, type RampSpec } from "../utilities";
import { baselineMbps, cpuCapacityMbps, EC2_ASSUMED, EC2_DEFAULTS, EC2_FIXED, resolveSpec, type EC2Config, type InstanceSpec } from "../ec2/throughput";
import { desiredCount } from "../ecs/throughput";

// Auto Scaling Group: launch template instance type × instances in service, with target
// tracking when min < max. Per-instance capacity is EC2's (NIC or CPU, whichever binds).
// Spec: .references/reduced-formulas-throughput.md §3.3, reduced-formulas-drop.md §6

export interface ASGConfig extends EC2Config {
  inServiceCount?: number;
  // target tracking; minSize = maxSize = inServiceCount means none
  minSize?: number;
  maxSize?: number;
  targetUtilization?: number;
}

export const ASG_DEFAULTS: Required<ASGConfig> = { ...EC2_DEFAULTS, inServiceCount: 1, minSize: 0, maxSize: 0, targetUtilization: 0.5 };

export interface ASGState {
  // one bucket for the group (instances burst in lockstep)
  credits: CreditState;
  scale: RampState;
}

// target tracking: 3 × 60 s datapoints, ~90 s launch + 150 s ELB health, 15 × 60 s scale-in
// datapoints, 300 s cooldown; warm-up blocks scale-in (simple scaling only)
export const ASG_SCALING = { delayUpS: 180, launchS: 240, delayDownS: 900, cooldownS: 300 } as const;

export function scalingSpec(c: Required<ASGConfig>): RampSpec {
  const floor = c.minSize > 0 ? c.minSize : c.inServiceCount;
  const ceiling = c.maxSize > 0 ? c.maxSize : c.inServiceCount;
  return { floor, ceiling: Math.max(floor, ceiling), rateUp: Infinity, rateDown: Infinity, ...ASG_SCALING };
}

export function instanceCapacityMbps(spec: InstanceSpec, nic: Mbps, ctx: ThroughputContext): { mbps: Mbps; cpuBound: boolean } {
  const cpu = cpuCapacityMbps(spec, sizeOf(ctx, EC2_ASSUMED.avgBytes));
  return cpu.value < nic.value ? { mbps: cpu, cpuBound: true } : { mbps: nic, cpuBound: false };
}

// instances in service this tick; the ramp advances only when `demand` is given (throughput pass)
export function instancesInService(c: Required<ASGConfig>, state: ASGState | undefined, ctx: ThroughputContext, demand?: Mbps, perInstance?: Mbps): number {
  if (state === undefined) return c.inServiceCount;
  if (demand === undefined || perInstance === undefined) return state.scale.level;
  const util = state.scale.level > 0 && perInstance.value > 0 ? demand.value / (state.scale.level * perInstance.value) : 0;
  return ramp(state.scale, desiredCount(state.scale.level, util, c.targetUtilization), scalingSpec(c), ctx);
}

export const model: ServiceModel<ASGConfig, ASGState> = {
  defaults: ASG_DEFAULTS,

  capacity(config) {
    const c = resolve(ASG_DEFAULTS, config);
    const spec = resolveSpec(c.instanceType);
    return mbps(c.inServiceCount * Math.min(spec.burstMbps.value, cpuCapacityMbps(spec, EC2_ASSUMED.avgBytes).value));
  },

  newState(config) {
    const c = resolve(ASG_DEFAULTS, config);
    const spec = resolveSpec(c.instanceType);
    return { credits: newCreditState(baselineMbps(spec).mbps, spec.burstMbps, EC2_FIXED.burstSeconds), scale: newRampState(c.inServiceCount) };
  },

  evaluate(config, state) {
    const c = resolve(ASG_DEFAULTS, config);
    const spec = resolveSpec(c.instanceType);
    const base = baselineMbps(spec);
    const sc = scalingSpec(c);
    return (ctx) => {
      const offeredNow = offeredMbps(ctx);
      const before = state?.scale.level ?? c.inServiceCount;
      const nic =
        state && ctx.dt !== undefined
          ? creditBucket({ baselineMbps: base.mbps, burstMbps: spec.burstMbps, demandMbps: mbps(offeredNow.value / Math.max(1, before)), burstSeconds: EC2_FIXED.burstSeconds, ctx }, state.credits)
          : spec.burstMbps;
      const per = instanceCapacityMbps(spec, nic, ctx);
      const n = instancesInService(c, state, ctx, offeredNow, per.mbps);
      const pending = state?.scale.pending.reduce((acc, p) => acc + p.amount, 0) ?? 0;
      return pipe(
        offered(ctx, ModelTier.Estimated),
        cap(mbps(n * per.mbps.value)),
        splitEven(ctx.outputCount),
        note(`capacity = ${n} × per-instance (${per.cpuBound ? "CPU-bound, processingMs assumed" : "NIC"})`),
        note(nic.value < spec.burstMbps.value && "network credits exhausted: at baseline"),
        note(sc.ceiling > sc.floor && pending > 0 && `${pending} instance(s) launching (~${ASG_SCALING.launchS} s)`),
      );
    };
  },
};
