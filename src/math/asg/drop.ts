import type { DropModel, EvaluateDrop } from "../../types/math";
import { note, pipe, resolve } from "../utilities";
import { ASG_DEFAULTS, ASG_SCALING, EMPTY_TEMPLATE, instancesInService, pendingInstances, perInstanceContext, type ASGConfig, type ASGState, type ASGTemplate } from "./throughput";

export const model: DropModel<ASGConfig, ASGState> & {
  evaluate(config?: ASGConfig, state?: ASGState, template?: ASGTemplate): EvaluateDrop;
} = {
  defaults: ASG_DEFAULTS,

  evaluate(config?: ASGConfig, state?: ASGState, template: ASGTemplate = EMPTY_TEMPLATE) {
    const c = resolve(ASG_DEFAULTS, config);
    return (ctx) => {
      const n = Math.max(1, instancesInService(c, state, ctx));
      const pending = pendingInstances(state);
      const r = template.drop(perInstanceContext(ctx, n));
      return pipe(
        r,
        note(r.rawDrop.value > 0 && pending > 0 && `${n} instance(s) overloaded while scaling out (~${ASG_SCALING.delayUpS + ASG_SCALING.launchS} s to in-service)`),
      );
    };
  },
};
