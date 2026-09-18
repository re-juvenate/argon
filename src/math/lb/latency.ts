import { ModelTier, type LatencyModel } from "../../types/math";
import { capTimeout, downstream, ms, note, pipe, resolve, start, tailMix } from "../utilities";
import { LB_DEFAULTS, LBKind, type LBConfig } from "./throughput";

// Fixed overhead + cross-zone hop; no queue of its own (auto-scales; a bound reservation
// rejects). The idle timeout caps the downstream tail (504).
// Spec: .references/reduced-formulas-latency.md §3.4

export const LB_LATENCY_FIXED = {
  idleTimeoutMs: ms(60_000),
  connectTimeoutMs: ms(10_000),
  minAzCount: 2,
} as const;

export const LB_LATENCY_ASSUMED = {
  overheadMs: { [LBKind.ALB]: ms(1), [LBKind.NLB]: ms(0.1) },
  // measured 0.25–3.4 ms
  crossAzMs: ms(1),
  azCount: 2,
} as const;

// cross-zone balancing sends 1 − 1/azCount of requests to another AZ
export function crossZoneHopMs(azCount = LB_LATENCY_ASSUMED.azCount): number {
  const n = Math.max(LB_LATENCY_FIXED.minAzCount, azCount);
  return LB_LATENCY_ASSUMED.crossAzMs.value * (1 - 1 / n);
}

export const model: LatencyModel<LBConfig> = {
  defaults: LB_DEFAULTS,

  evaluate(config) {
    const c = resolve(LB_DEFAULTS, config);
    const own = ms(LB_LATENCY_ASSUMED.overheadMs[c.kind].value + crossZoneHopMs());
    return (ctx) => {
      const targets = ctx.downstreamMs;
      const targetTail = targets && targets.length > 0 ? tailMix(targets.map((p99Ms) => ({ share: 1 / targets.length, p99Ms }))) : undefined;
      return pipe(
        start(own, ModelTier.Assumed),
        downstream(targetTail && ms(Math.min(targetTail.value, LB_LATENCY_FIXED.idleTimeoutMs.value))),
        capTimeout(ms(own.value + LB_LATENCY_FIXED.idleTimeoutMs.value)),
        note(`${c.kind.toUpperCase()} overhead assumed; cross-zone hop ${crossZoneHopMs().toFixed(2)} ms (crossAz 1 ms × (1 − 1/${LB_LATENCY_ASSUMED.azCount}))`),
        note(targetTail !== undefined && targetTail.value > LB_LATENCY_FIXED.idleTimeoutMs.value && "target tail exceeds idle timeout: 504s (see loss model)"),
      );
    };
  },
};
