import { ModelTier, type ServiceModel } from "../../types/math";
import { cap, mbps, note, offered, pipe, splitWeighted } from "../utilities";

// Route 53 is not in the data path: it splits traffic across outputs by record weight and
// health, both of which you configure on the records. Public DNS has no throughput cap.
// Spec: .references/reduced-formulas-throughput.md §3.9

export interface Route53Config {
  // one weight per output socket; missing entries default to 1
  weights?: readonly number[];
  // one flag per output socket; missing entries default to healthy
  healthy?: readonly boolean[];
}

export const ROUTE53_DEFAULTS: Required<Route53Config> = { weights: [], healthy: [] };

export function effectiveWeights(outputCount: number, config?: Route53Config): number[] {
  const weights = Array.from({ length: outputCount }, (_, i) => config?.weights?.[i] ?? 1);
  const healthy = Array.from({ length: outputCount }, (_, i) => config?.healthy?.[i] ?? true);
  const anyHealthy = healthy.some(Boolean);
  // "If none of the records … are healthy, Route 53 considers all records healthy."
  return weights.map((w, i) => (anyHealthy && !healthy[i] ? 0 : w));
}

export const model: ServiceModel<Route53Config> = {
  defaults: ROUTE53_DEFAULTS,

  capacity() {
    return mbps(Infinity);
  },

  evaluate(config) {
    return (ctx) => {
      const weights = effectiveWeights(ctx.outputCount, config);
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(mbps(Infinity)),
        splitWeighted(weights),
        note(weights.some((w) => w === 0) && "unhealthy records removed from the split"),
      );
    };
  },
};
