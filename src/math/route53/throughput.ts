import { ModelTier, type ServiceModel, type Stamped, type ThroughputContext } from "../../types/math";
import { advanced, cap, current, mbps, note, offered, pipe, resolve, splitWeighted } from "../utilities";

// Route 53 is not in the data path: it splits traffic across outputs by record weight and
// health. Health is seen late (interval × threshold) and resolvers keep the old answer for up
// to a TTL, so the split converges with a first-order lag. Public DNS has no throughput cap.
// Spec: .references/reduced-formulas-throughput.md §3.9, reduced-formulas-drop.md §6

export interface Route53Config {
  // one weight per output socket; missing entries default to 1
  weights?: readonly number[];
  // actual health, one flag per output socket; missing entries default to healthy
  healthy?: readonly boolean[];
  // health check interval (30 | 10) × failure threshold = detection delay
  intervalS?: number;
  failureThreshold?: number;
  ttlS?: number;
}

export const ROUTE53_DEFAULTS: Required<Route53Config> = { weights: [], healthy: [], intervalS: 30, failureThreshold: 3, ttlS: 300 };

// resolvers floor short TTLs (some refuse to cache < 30 s)
export const ROUTE53_FIXED = { resolverTtlFloorS: 30 } as const;

export interface Route53State extends Stamped {
  // health Route 53 currently believes, and how long the actual state has disagreed
  believed: boolean[];
  disagreeS: number[];
  // share of clients per record after TTL lag
  share: number[];
}

export function effectiveWeights(outputCount: number, config?: Route53Config, believed?: readonly boolean[]): number[] {
  const weights = Array.from({ length: outputCount }, (_, i) => config?.weights?.[i] ?? 1);
  const healthy = Array.from({ length: outputCount }, (_, i) => believed?.[i] ?? config?.healthy?.[i] ?? true);
  const anyHealthy = healthy.some(Boolean);
  // "If none of the records … are healthy, Route 53 considers all records healthy."
  return weights.map((w, i) => (anyHealthy && !healthy[i] ? 0 : w));
}

const normalize = (w: readonly number[]): number[] => {
  const total = w.reduce((acc, x) => acc + Math.max(0, x), 0);
  return total > 0 ? w.map((x) => Math.max(0, x) / total) : w.map(() => 1 / Math.max(1, w.length));
};

// shares this tick: the lagged split when state is current, else the instantaneous one
export function shares(c: Required<Route53Config>, state: Route53State | undefined, ctx: ThroughputContext, advance = false): number[] {
  const n = ctx.outputCount;
  if (state === undefined || ctx.dt === undefined) return normalize(effectiveWeights(n, c));
  if (advance && !advanced(state, ctx)) {
    const dt = ctx.dt.value;
    const detectS = c.intervalS * c.failureThreshold;
    while (state.believed.length < n) state.believed.push(true), state.disagreeS.push(0);
    for (let i = 0; i < n; i++) {
      const actual = c.healthy[i] ?? true;
      state.disagreeS[i] = actual === state.believed[i] ? 0 : state.disagreeS[i] + dt;
      if (state.disagreeS[i] >= detectS) (state.believed[i] = actual), (state.disagreeS[i] = 0);
    }
    const target = normalize(effectiveWeights(n, c, state.believed));
    const tau = Math.max(c.ttlS, ROUTE53_FIXED.resolverTtlFloorS);
    if (state.share.length !== n) state.share = target.slice();
    else state.share = state.share.map((s, i) => s + ((target[i] - s) * Math.min(1, dt / tau)));
    state.tick = ctx.tick;
  }
  return current(state, ctx)?.share ?? normalize(effectiveWeights(n, c));
}

export const model: ServiceModel<Route53Config, Route53State> = {
  defaults: ROUTE53_DEFAULTS,

  capacity() {
    return mbps(Infinity);
  },

  newState() {
    return { believed: [], disagreeS: [], share: [] };
  },

  evaluate(config, state) {
    const c = resolve(ROUTE53_DEFAULTS, config);
    return (ctx) => {
      const split = shares(c, state, ctx, true);
      const believedUnhealthy = state?.believed.some((b) => !b) ?? false;
      const actualUnhealthy = c.healthy.some((h) => !h);
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(mbps(Infinity)),
        splitWeighted(split),
        note(actualUnhealthy && !believedUnhealthy && state !== undefined && `unhealthy record not yet detected (${c.intervalS} s × ${c.failureThreshold})`),
        note(believedUnhealthy && `unhealthy record removed; resolvers converge over TTL ${Math.max(c.ttlS, ROUTE53_FIXED.resolverTtlFloorS)} s`),
        note(state === undefined && actualUnhealthy && "unhealthy records removed from the split (steady state)"),
      );
    };
  },
};
