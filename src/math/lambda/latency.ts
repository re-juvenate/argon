import { ModelTier, type LatencyModel } from "../../types/math";
import { current, ms, note, offeredMbps, pipe, sizeOf, start, tail, toRps } from "../utilities";
import { durationMs, LAMBDA_ASSUMED, LAMBDA_DEFAULTS, type LambdaConfig, type LambdaState } from "./throughput";

// No queue for sync invocations (warm env, cold env, or 429): bimodal, p99 = cold start when
// ≥ 1 % of requests hit one.
// Spec: .references/reduced-formulas-latency.md §3.6

export const LAMBDA_LATENCY_MEASURED = {
  // Node.js 24 total cold start p50 @1769 MB (k-i-soft)
  coldStartMs: ms(400),
  // init is independent of memory (k-i-soft)
  coldStartScalesWithMemory: false,
} as const;

export const model: LatencyModel<LambdaConfig, LambdaState> = {
  defaults: LAMBDA_DEFAULTS,

  evaluate(config, state) {
    const duration = durationMs(config);
    return (ctx) => {
      const s = current(state, ctx);
      let coldFraction = 0;
      if (s !== undefined && ctx.dt !== undefined) {
        const requests = toRps(offeredMbps(ctx), sizeOf(ctx, LAMBDA_ASSUMED.avgBytes)) * ctx.dt.value;
        coldFraction = requests > 0 ? Math.min(1, s.createdEnvs / requests) : 0;
      }
      const cold = LAMBDA_LATENCY_MEASURED.coldStartMs.value;
      return pipe(
        start(ms(duration), ModelTier.Estimated),
        (r) => ({ ...r, p50Ms: ms(duration + coldFraction * cold) }),
        tail(ms(duration + (coldFraction > 0.01 ? cold : 0))),
        note(`duration ${duration.toFixed(0)} ms from memory (100 ms @ 1 vCPU assumed)`),
        note(coldFraction > 0.01 && `cold starts on ${(coldFraction * 100).toFixed(1)}% of requests: p99 = cold start (Node.js; JVM 2–6 s)`),
        note(s === undefined && "steady state: no cold starts"),
      );
    };
  },
};
