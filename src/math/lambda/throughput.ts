import { ModelTier, type Mbps, type ServiceModel, type Stamped } from "../../types/math";
import { advanced, bytes, cap, KiB, mbps, note, offered, offeredMbps, pipe, resolve, splitEven, toMbps, toRps } from "../utilities";

// Lambda. At setup you choose memory and (optionally) reserved concurrency; the account's
// regional concurrency is an AWS quota. Function duration and payload size are properties
// of the code, so they are fixed assumptions here.
// Spec: .references/reduced-formulas-throughput.md §3.6

export interface LambdaConfig {
  memoryMb?: number;
  // 0 = none reserved (share the regional pool)
  reservedConcurrency?: number;
  regionConcurrency?: number;
}

export const LAMBDA_DEFAULTS: Required<LambdaConfig> = { memoryMb: 1769, reservedConcurrency: 0, regionConcurrency: 1000 };

export const LAMBDA_FIXED = {
  envBandwidthMbps: mbps(625),
  // sync invocations: rps ≤ 10 × concurrency
  rpsPerConcurrency: 10,
  // 1,000 environments per 10 s
  scaleRatePerSec: 100,
  // memory at which a function has one vCPU
  mbPerVcpu: 1769,
} as const;

export const LAMBDA_ASSUMED = {
  // duration measured at 1 vCPU (1769 MB); CPU-bound scaling below that
  durationMsAt1Vcpu: 100,
  avgBytes: bytes(16 * KiB),
  sync: true,
} as const;

export interface LambdaState extends Stamped {
  warmEnvs: number;
  // added by the ramp on the last tick (cold starts)
  createdEnvs: number;
}

export function concurrencyCeiling(config?: LambdaConfig): number {
  const c = resolve(LAMBDA_DEFAULTS, config);
  return c.reservedConcurrency > 0 ? c.reservedConcurrency : c.regionConcurrency;
}

export function durationMs(config?: LambdaConfig): number {
  const c = resolve(LAMBDA_DEFAULTS, config);
  return LAMBDA_ASSUMED.durationMsAt1Vcpu * Math.max(1, LAMBDA_FIXED.mbPerVcpu / c.memoryMb);
}

export function capacityForEnvs(envs: number, config?: LambdaConfig): Mbps {
  const rpsFromDuration = (envs * 1000) / durationMs(config);
  const rpsCap = LAMBDA_ASSUMED.sync ? Math.min(rpsFromDuration, LAMBDA_FIXED.rpsPerConcurrency * envs) : rpsFromDuration;
  return mbps(Math.min(toMbps(rpsCap, LAMBDA_ASSUMED.avgBytes).value, envs * LAMBDA_FIXED.envBandwidthMbps.value));
}

export const model: ServiceModel<LambdaConfig, LambdaState> = {
  defaults: LAMBDA_DEFAULTS,

  // steady state: every unit of concurrency is warm
  capacity(config) {
    return capacityForEnvs(concurrencyCeiling(config), config);
  },

  newState() {
    return { warmEnvs: 0, createdEnvs: 0 };
  },

  evaluate(config, state) {
    const ceiling = concurrencyCeiling(config);
    const duration = durationMs(config);
    return (ctx) => {
      let envs = ceiling;
      let scaling = false;
      if (state && ctx.dt !== undefined) {
        const demandEnvs = (toRps(offeredMbps(ctx), LAMBDA_ASSUMED.avgBytes) * duration) / 1000;
        if (!advanced(state, ctx)) {
          const created = Math.min(Math.max(0, demandEnvs - state.warmEnvs), LAMBDA_FIXED.scaleRatePerSec * ctx.dt.value, ceiling - state.warmEnvs);
          state.warmEnvs += created;
          state.createdEnvs = created;
          state.tick = ctx.tick;
        }
        envs = state.warmEnvs;
        scaling = demandEnvs > envs;
      }
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(capacityForEnvs(envs, config)),
        splitEven(ctx.outputCount),
        note(scaling && "scaling: demand exceeds warm environments (429 for sync)"),
      );
    };
  },
};
