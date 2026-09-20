import {
  DropKind,
  ModelTier,
  type Evaluate,
  type EvaluateDrop,
  type EvaluateLatency,
  type Mbps,
  type RampState,
  type ServiceModel,
  type ThroughputContext,
  type ThroughputResult,
} from "../../types/math";
import { cap, cause, mbps, ms, newRampState, note, offered, offeredMbps, pipe, ramp, resolve, splitEven, start, startDrop, type RampSpec } from "../utilities";
import { desiredCount } from "../ecs/throughput";

export interface ASGConfig {
  inServiceCount?: number;
  minSize?: number;
  maxSize?: number;
  targetUtilization?: number;
  showAnimations?: boolean;
}

export const ASG_DEFAULTS: Required<ASGConfig> = { inServiceCount: 1, minSize: 0, maxSize: 0, targetUtilization: 0.5, showAnimations: true };

export interface ASGState {
  scale: RampState;
}

export interface ASGTemplate {
  capacity: (ctx: ThroughputContext) => Mbps;
  throughput: Evaluate;
  latency: EvaluateLatency;
  drop: EvaluateDrop;
}

export const ASG_SCALING = { delayUpS: 180, launchS: 240, delayDownS: 900, cooldownS: 300 } as const;

export function scalingSpec(c: Required<ASGConfig>): RampSpec {
  const floor = c.minSize > 0 ? c.minSize : c.inServiceCount;
  const ceiling = c.maxSize > 0 ? c.maxSize : c.inServiceCount;
  return { floor, ceiling: Math.max(floor, ceiling), rateUp: Infinity, rateDown: Infinity, ...ASG_SCALING };
}

export function instancesInService(c: Required<ASGConfig>, state: ASGState | undefined, ctx: ThroughputContext, demand?: Mbps, perInstance?: Mbps): number {
  if (state === undefined) return c.inServiceCount;
  if (demand === undefined || perInstance === undefined) return state.scale.level;
  const util = state.scale.level > 0 && perInstance.value > 0 ? demand.value / (state.scale.level * perInstance.value) : 0;
  return ramp(state.scale, desiredCount(state.scale.level, util, c.targetUtilization), scalingSpec(c), ctx);
}

export const newASGState = (config?: ASGConfig): ASGState => ({ scale: newRampState(resolve(ASG_DEFAULTS, config).inServiceCount) });

export const pendingInstances =(state: ASGState | undefined): number => state?.scale.pending.reduce((acc, p) => acc + p.amount, 0) ?? 0;

export const perInstanceContext = <C extends ThroughputContext>(ctx: C, n: number): C => ({
  ...ctx,
  inputsMbps: [mbps(offeredMbps(ctx).value / Math.max(1, n))],
  outputCount: 1,
});

export const EMPTY_TEMPLATE: ASGTemplate = {
  capacity: () => mbps(0),
  throughput: (ctx) => pipe(offered(ctx, ModelTier.Assumed), cap(mbps(0)), note("no instances in the group")),
  latency: () => start(ms(0), ModelTier.Assumed),
  drop: (ctx) => {
    const r = startDrop(ctx, mbps(0), ModelTier.Assumed);
    return pipe(r, cause(DropKind.Overflow, r.rawDrop), note("no instances in the group"));
  },
};

export const model: ServiceModel<ASGConfig, ASGState> & {
  evaluate(config?: ASGConfig, state?: ASGState, template?: ASGTemplate): Evaluate;
} = {
  defaults: ASG_DEFAULTS,

  capacity(config) {
    const c = resolve(ASG_DEFAULTS, config);
    return mbps(c.inServiceCount);
  },

  newState(config) {
    return newASGState(config);
  },

  evaluate(config?: ASGConfig, state?: ASGState, template: ASGTemplate = EMPTY_TEMPLATE) {
    const c = resolve(ASG_DEFAULTS, config);
    const sc = scalingSpec(c);
    return (ctx): ThroughputResult => {
      const before = state?.scale.level ?? c.inServiceCount;
      const per = template.capacity(perInstanceContext(ctx, before));
      const n = instancesInService(c, state, ctx, offeredMbps(ctx), per);
      const instance = template.throughput(perInstanceContext(ctx, n));
      const pending = pendingInstances(state);
      return pipe(
        offered(ctx, instance.model),
        cap(mbps(n * instance.capacityMbps.value)),
        splitEven(ctx.outputCount),
        note(`capacity = ${n} × per-instance ${instance.capacityMbps.value.toFixed(1)} Mbps`),
        note(sc.ceiling > sc.floor && pending > 0 && `${pending} instance(s) launching (~${ASG_SCALING.launchS} s)`),
        ...instance.notes.map((text: string) => note<ThroughputResult>(text)),
      );
    };
  },
};
