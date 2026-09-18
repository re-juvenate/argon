import { DropKind, ModelTier, type DropModel } from "../../types/math";
import { cause, meanRatio, note, offeredMbps, pipe, ratio, resolve, sizeOf, startDrop, tailExceed, toRps } from "../utilities";
import { LB_LATENCY_FIXED } from "./latency";
import { LB_ASSUMED, LB_DEFAULTS, LBKind, reservedCapacity, type LBConfig } from "./throughput";

// Rejected (reservation bound), 503 (no healthy target), forwarded target 5xx, 504 (idle
// timeout), NLB port exhaustion (55,000 conn/target). Source: load-balancer-troubleshooting doc.
// Spec: .references/reduced-formulas-drop.md §3.4

export const NLB_FIXED = { connectionsPerTarget: 55_000 } as const;

export const model: DropModel<LBConfig> = {
  defaults: LB_DEFAULTS,

  evaluate(config) {
    const c = resolve(LB_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, LB_ASSUMED.avgBytes);
      const r = startDrop(ctx, reservedCapacity(offeredMbps(ctx), c, size), ModelTier.Estimated);
      const targets = ctx.downstreamDrop ?? [];
      const live = targets.map((_, i) => i).filter((i) => targets[i].value < 1);
      const allDead = targets.length > 0 && live.length === 0;
      const forwarded = meanRatio(live.map((i) => targets[i]));
      const timeouts = meanRatio(live.map((i) => tailExceed(ctx.downstreamMs?.[i], LB_LATENCY_FIXED.idleTimeoutMs)));
      let port = ratio(0);
      if (c.kind === LBKind.NLB && ctx.outputCount > 0) {
        const activePerTarget = (toRps(offeredMbps(ctx), size) * LB_ASSUMED.connSeconds) / ctx.outputCount;
        port = ratio(Math.max(0, 1 - NLB_FIXED.connectionsPerTarget / activePerTarget));
      }
      return pipe(
        r,
        cause(DropKind.Refused, r.rawDrop),
        cause(DropKind.Refused, ratio(allDead ? 1 : 0)),
        cause(DropKind.Downstream, forwarded),
        cause(DropKind.Timeout, timeouts),
        cause(DropKind.Refused, port),
        note(r.rawDrop.value > 0 && "reservation bound: RejectedConnectionCount"),
        note(allDead && "no healthy targets: 503"),
        note(live.length < targets.length && !allDead && `${targets.length - live.length} dead target(s) out of rotation (even split upstream not re-routed)`),
        note(timeouts.value > 0 && `target tail past ${LB_LATENCY_FIXED.idleTimeoutMs.value / 1000} s idle timeout: 504`),
        note(port.value > 0 && "NLB: > 55,000 connections per target: PortAllocationErrorCount"),
        note("502 keep-alive mismatch is a config bug, not load: 0"),
      );
    };
  },
};
