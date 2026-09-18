import { ModelTier, type CreditState, type Mbps, type ServiceModel } from "../../types/math";
import { cap, creditBucket, mbps, newCreditState, note, offered, offeredMbps, pipe, resolve, seconds, splitEven, tier } from "../utilities";

// ECS on Fargate. At setup you choose task CPU, task memory and the desired task count;
// bandwidth is not published, so it is a piecewise fit of the iperf3 task table.
// Spec: .references/reduced-formulas-throughput.md §3.2

export interface FargateConfig {
  vcpu?: number;
  memGiB?: number;
  tasks?: number;
}

export const FARGATE_DEFAULTS: Required<FargateConfig> = { vcpu: 1, memGiB: 2, tasks: 1 };

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

export const model: ServiceModel<FargateConfig, CreditState> = {
  defaults: FARGATE_DEFAULTS,

  capacity(config) {
    const c = resolve(FARGATE_DEFAULTS, config);
    return mbps(c.tasks * taskBurstMbps(c.vcpu, c.memGiB).value);
  },

  newState(config) {
    const c = resolve(FARGATE_DEFAULTS, config);
    return newCreditState(taskBaselineMbps(c.vcpu, c.memGiB).mbps, taskBurstMbps(c.vcpu, c.memGiB), FARGATE_FIXED.burstSeconds);
  },

  evaluate(config, state) {
    const c = resolve(FARGATE_DEFAULTS, config);
    const base = taskBaselineMbps(c.vcpu, c.memGiB);
    const burst = taskBurstMbps(c.vcpu, c.memGiB);
    return (ctx) => {
      const perTask =
        state && ctx.dt !== undefined
          ? creditBucket(
              {
                baselineMbps: base.mbps,
                burstMbps: burst,
                demandMbps: mbps(offeredMbps(ctx).value / Math.max(1, c.tasks)),
                burstSeconds: FARGATE_FIXED.burstSeconds,
                dt: ctx.dt,
              },
              state,
            )
          : burst;
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(mbps(c.tasks * perTask.value)),
        splitEven(ctx.outputCount),
        note(base.extrapolated && "baseline extrapolated beyond measured 4 vCPU"),
        note(perTask.value === base.mbps.value && "network credits exhausted: at baseline"),
        tier(base.extrapolated ? ModelTier.Assumed : ModelTier.Measured),
      );
    };
  },
};
