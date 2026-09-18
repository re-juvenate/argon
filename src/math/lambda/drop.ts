import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, current, note, pipe, ratio, resolve, startDrop } from "../utilities";
import { capacityForEnvs, concurrencyCeiling, LAMBDA_ASSUMED, LAMBDA_DEFAULTS, type LambdaConfig, type LambdaState } from "./throughput";

// Sync overflow = 429; capacity = envs warm after this tick's ramp (or the ceiling). Async ≈ 0.
// Spec: .references/reduced-formulas-drop.md §3.6

export const model: DropModel<LambdaConfig, LambdaState> = {
  defaults: LAMBDA_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(LAMBDA_DEFAULTS, config);
    const ceiling = concurrencyCeiling(c);
    return (ctx) => {
      const s = current(state, ctx);
      const envs = s?.warmEnvs ?? ceiling;
      const r = startDrop(ctx, capacityForEnvs(envs, c), ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Throttle, LAMBDA_ASSUMED.sync ? r.rawDrop : ratio(0)),
        note(r.rawDrop.value > 0 && (LAMBDA_ASSUMED.sync ? "throttled: 429 to the caller" : "throttled: queued and retried (async), latency instead of loss")),
        note(envs < ceiling && `scaling: ${envs.toFixed(0)} of ${ceiling} environments warm`),
        note(state !== undefined && s === undefined && "state not advanced this tick: steady state"),
        note("function errors are not a capacity property: not modelled"),
      );
    };
  },
};
