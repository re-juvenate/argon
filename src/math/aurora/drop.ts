import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, note, offeredMbps, pipe, ratio, resolve, startDropServed, toMbps, toRps } from "../utilities";
import { AURORA_ASSUMED, AURORA_DEFAULTS, capacityRps, resolveClass, type AuroraConfig } from "./throughput";

// Refused connections past max_connections (hard) + pool overflow as client timeouts (the
// engine does not throttle). Failover windows are events, not steady state.
// Spec: .references/reduced-formulas-drop.md §3.10

export const model: DropModel<AuroraConfig> = {
  defaults: AURORA_DEFAULTS,

  evaluate(config) {
    const c = resolve(AURORA_DEFAULTS, config);
    const { cls, note: classNote } = resolveClass(c);
    const { readFraction, rowBytes, queryMs } = AURORA_ASSUMED;
    const cap = capacityRps(c);
    const maxConn = cls.maxConnections * (1 + c.readers);
    return (ctx) => {
      // same independent read/write split as the throughput model
      const offered = offeredMbps(ctx);
      const rps = toRps(offered, rowBytes);
      const servedRps = Math.min(rps * (1 - readFraction), cap.writeRps) + Math.min(rps * readFraction, cap.readRps);
      const r = startDropServed(offered, toMbps(servedRps, rowBytes), ModelTier.Assumed);
      const connDemand = (rps * queryMs) / 1000;
      const refused = ratio(connDemand > 0 ? Math.max(0, 1 - maxConn / connDemand) : 0);
      return pipe(
        r,
        cause(DropKind.Refused, refused),
        cause(DropKind.Timeout, r.rawDrop),
        note(refused.value > 0 && `connections ${connDemand.toFixed(0)} > max_connections ${maxConn}: refused`),
        note(r.rawDrop.value > 0 && "pool over capacity: no engine throttle, overflow shown as client timeouts"),
        note(classNote),
        note("failover windows (7–60 s) are events: not modelled"),
      );
    };
  },
};
