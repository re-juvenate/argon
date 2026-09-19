import type { EvaluateLatency, LatencyModel } from "../../types/math";
import { note, pipe, resolve } from "../utilities";
import { ASG_DEFAULTS, EMPTY_TEMPLATE, instancesInService, perInstanceContext, type ASGConfig, type ASGState, type ASGTemplate } from "./throughput";

export const model: LatencyModel<ASGConfig, ASGState> & {
  evaluate(config?: ASGConfig, state?: ASGState, template?: ASGTemplate): EvaluateLatency;
} = {
  defaults: ASG_DEFAULTS,

  evaluate(config?: ASGConfig, state?: ASGState, template: ASGTemplate = EMPTY_TEMPLATE) {
    const c = resolve(ASG_DEFAULTS, config);
    return (ctx) => {
      const n = Math.max(1, instancesInService(c, state, ctx));
      return pipe(template.latency(perInstanceContext(ctx, n)), note(`${n} independent instance queues at λ / n`));
    };
  },
};
