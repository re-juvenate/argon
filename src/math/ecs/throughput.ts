import { ModelTier, type Bytes, type CreditState, type Mbps, type RampState, type ServiceModel, type ThroughputContext } from "../../types/math";
import { cap, creditBucket, mbps, newCreditState, newRampState, note, offered, offeredMbps, pipe, ramp, resolve, seconds, sizeOf, splitEven, tier, toMbps, type RampSpec } from "../utilities";
import { EC2_ASSUMED } from "../ec2/throughput";

// ECS on Fargate. At setup you choose task CPU, task memory, the desired task count and,
// optionally, service auto scaling (min / max / target utilization). Bandwidth is a piecewise
// fit of the iperf3 task table; CPU capacity is vCPU × an assumed per-request time.
// Spec: .references/reduced-formulas-throughput.md §3.2, reduced-formulas-drop.md §6

export interface FargateConfig {
  vcpu?: number;
  memGiB?: number;
  tasks?: number;
  // service auto scaling; minTasks = maxTasks = tasks means none
  minTasks?: number;
  maxTasks?: number;
  targetUtilization?: number;
}

export const FARGATE_DEFAULTS: Required<FargateConfig> = { vcpu: 1, memGiB: 2, tasks: 1, minTasks: 0, maxTasks: 0, targetUtilization: 0.5 };

export interface FargateState {
  credits: CreditState;
  scale: RampState;
}

// target tracking: 3 × 60 s datapoints, ~90 s task launch + 30 s × 5 health checks, 15 × 60 s
// scale-in datapoints, 300 s cooldowns
export const FARGATE_SCALING = { delayUpS: 180, launchS: 240, delayDownS: 900, cooldownS: 300, scaleInBelow: 0.9 } as const;

export function scalingSpec(c: Required<FargateConfig>): RampSpec {
  const floor = c.minTasks > 0 ? c.minTasks : c.tasks;
  const ceiling = c.maxTasks > 0 ? c.maxTasks : c.tasks;
  return { floor, ceiling: Math.max(floor, ceiling), rateUp: Infinity, rateDown: Infinity, ...FARGATE_SCALING };
}

// desired count from target tracking: ceil(current · util / target), scale-in only below 0.9·target
export function desiredCount(level: number, utilization: number, target: number): number {
  if (utilization > target) return Math.ceil((level * utilization) / target);
  if (utilization < target * FARGATE_SCALING.scaleInBelow) return Math.max(1, Math.ceil((level * utilization) / target));
  return level;
}

// unsourced (r/aws: "Fargate CPU isn't as powerful"); 1 = same as EC2
export const FARGATE_CPU_EFFICIENCY = 1;

export const taskCpuMbps = (vcpu: number, size: Bytes): Mbps => toMbps((vcpu * FARGATE_CPU_EFFICIENCY * 1000) / EC2_ASSUMED.processingMs, size);

export const FARGATE_FIXED = {
  // measured burst durations 300–1120 s
  burstSeconds: seconds(600),
  mbpsPerGiB: 124,
  tier1Cap: mbps(744),
  tier2Cap: mbps(1241),
  burstSmall: mbps(4700),
  burstLarge: mbps(9800),
} as const;

export function taskBaselineMbps(vcpu: number, memGiB: number): { mbps: Mbps; extrapolated: boolean } {
  const f = FARGATE_FIXED;
  if (vcpu <= 0.5) return { mbps: mbps(f.mbpsPerGiB * memGiB), extrapolated: false };
  if (vcpu <= 1) return { mbps: mbps(Math.min(f.mbpsPerGiB * memGiB, f.tier1Cap.value)), extrapolated: false };
  if (vcpu <= 2) return { mbps: memGiB >= 16 ? f.tier2Cap : f.tier1Cap, extrapolated: false };
  if (vcpu <= 4) return { mbps: f.tier2Cap, extrapolated: false };
  // 8 / 16 vCPU were not measured; scale the 4-vCPU tier
  return { mbps: mbps(f.tier2Cap.value * (vcpu / 4)), extrapolated: true };
}

// what the last tick granted; steady state = burst
export function taskAvailableMbps(baseline: Mbps, burst: Mbps, state?: CreditState): Mbps {
  return state?.availableMbps ?? (state !== undefined && state.creditsMbit <= 0 ? baseline : burst);
}

export function taskBurstMbps(vcpu: number, memGiB: number): Mbps {
  return vcpu >= 2 || (vcpu >= 1 && memGiB >= 8) ? FARGATE_FIXED.burstLarge : FARGATE_FIXED.burstSmall;
}

// per-task capacity for the request size: NIC or CPU, whichever binds
export function taskCapacityMbps(c: Required<FargateConfig>, nic: Mbps, size: Bytes): { mbps: Mbps; cpuBound: boolean } {
  const cpu = taskCpuMbps(c.vcpu, size);
  return cpu.value < nic.value ? { mbps: cpu, cpuBound: true } : { mbps: nic, cpuBound: false };
}

// tasks in service this tick (ramp advances only on the throughput pass, i.e. when `demand` is given)
export function tasksInService(c: Required<FargateConfig>, state: FargateState | undefined, ctx: ThroughputContext, demandMbps?: Mbps, perTask?: Mbps): number {
  if (state === undefined) return c.tasks;
  if (demandMbps === undefined || perTask === undefined) return state.scale.level;
  const util = state.scale.level > 0 && perTask.value > 0 ? demandMbps.value / (state.scale.level * perTask.value) : 0;
  return ramp(state.scale, desiredCount(state.scale.level, util, c.targetUtilization), scalingSpec(c), ctx);
}

export const model: ServiceModel<FargateConfig, FargateState> = {
  defaults: FARGATE_DEFAULTS,

  capacity(config) {
    const c = resolve(FARGATE_DEFAULTS, config);
    return mbps(c.tasks * taskCapacityMbps(c, taskBurstMbps(c.vcpu, c.memGiB), EC2_ASSUMED.avgBytes).mbps.value);
  },

  newState(config) {
    const c = resolve(FARGATE_DEFAULTS, config);
    return {
      credits: newCreditState(taskBaselineMbps(c.vcpu, c.memGiB).mbps, taskBurstMbps(c.vcpu, c.memGiB), FARGATE_FIXED.burstSeconds),
      scale: newRampState(c.tasks),
    };
  },

  evaluate(config, state) {
    const c = resolve(FARGATE_DEFAULTS, config);
    const base = taskBaselineMbps(c.vcpu, c.memGiB);
    const burst = taskBurstMbps(c.vcpu, c.memGiB);
    const spec = scalingSpec(c);
    return (ctx) => {
      const size = sizeOf(ctx, EC2_ASSUMED.avgBytes);
      const offeredNow = offeredMbps(ctx);
      const tasksBefore = state?.scale.level ?? c.tasks;
      const nic =
        state && ctx.dt !== undefined
          ? creditBucket(
              { baselineMbps: base.mbps, burstMbps: burst, demandMbps: mbps(offeredNow.value / Math.max(1, tasksBefore)), burstSeconds: FARGATE_FIXED.burstSeconds, ctx },
              state.credits,
            )
          : burst;
      const perTask = taskCapacityMbps(c, nic, size);
      const tasks = tasksInService(c, state, ctx, offeredNow, perTask.mbps);
      const pendingTasks = state?.scale.pending.reduce((acc, p) => acc + p.amount, 0) ?? 0;
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(mbps(tasks * perTask.mbps.value)),
        splitEven(ctx.outputCount),
        note(base.extrapolated && "baseline extrapolated beyond measured 4 vCPU"),
        note(nic.value === base.mbps.value && "network credits exhausted: at baseline"),
        note(perTask.cpuBound && `CPU-bound: ${c.vcpu} vCPU × ${EC2_ASSUMED.processingMs} ms/request (assumed)`),
        note(spec.ceiling > spec.floor && `${tasks} task(s) in service${pendingTasks > 0 ? `, ${pendingTasks} launching (~${FARGATE_SCALING.launchS} s)` : ""}; target ${c.targetUtilization}`),
        tier(perTask.cpuBound || base.extrapolated ? ModelTier.Assumed : ModelTier.Measured),
      );
    };
  },
};
