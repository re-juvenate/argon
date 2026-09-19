import { DropKind, ModelTier, type CreditState, type DropModel } from "../../types/math";
import { cause, current, mbps, note, num, parseCsv, pipe, ratio, resolve, sizeOf, startDrop } from "../utilities";
import { availableMbps } from "./latency";
import planCsv from "./plantype.csv?raw";
import { cpuCapacityMbps, EC2_ASSUMED, EC2_DEFAULTS, resolveSpec, type EC2Config } from "./throughput";

// NIC overflow (ENA "queue then drop") plus Spot reclaim. PPS / conntrack allowances unpublished.
// Spec: .references/reduced-formulas-drop.md §3.1

export interface PlanSpec {
  plan: string;
  reclaimable: boolean;
}

export const PLAN_SPECS: Record<string, PlanSpec> = Object.fromEntries(
  parseCsv(planCsv).map((row) => [row.PurchasingOption, { plan: row.PurchasingOption, reclaimable: num(row.ReclaimableByAWS, 0) > 0 }]),
);

export const EC2_DROP_ASSUMED = {
  // Spot Advisor "<5 %" band
  spotInterruptionsPerMonth: 0.05,
  spotReplaceSeconds: 300,
} as const;

export function spotFloor(plan: string): number {
  const spec = PLAN_SPECS[plan];
  if (!spec?.reclaimable) return 0;
  return (EC2_DROP_ASSUMED.spotInterruptionsPerMonth * EC2_DROP_ASSUMED.spotReplaceSeconds) / (30 * 86_400);
}

export const model: DropModel<EC2Config, CreditState> = {
  defaults: EC2_DEFAULTS,

  evaluate(config, state) {
    const c = resolve(EC2_DEFAULTS, config);
    const spec = resolveSpec(c.instanceType);
    const spot = spotFloor(c.plan);
    return (ctx) => {
      const s = current(state, ctx);
      const bw = availableMbps(spec, s);
      const cpu = cpuCapacityMbps(spec, sizeOf(ctx, EC2_ASSUMED.avgBytes));
      const r = startDrop(ctx, mbps(Math.min(bw.value, cpu.value)), ModelTier.Measured);
      return pipe(
        r,
        cause(DropKind.Overflow, r.rawDrop),
        cause(DropKind.Reclaimed, ratio(spot)),
        note(r.rawDrop.value > 0 && (cpu.value < bw.value ? "CPU saturated: requests time out / are refused (processingMs assumed)" : "NIC allowance exceeded: queued then dropped (TCP retransmits, UDP loses)")),
        note(bw.value < spec.burstMbps.value && "network credits exhausted: capacity at baseline"),
        note(state !== undefined && s === undefined && "state not advanced this tick: steady state"),
        note(spot > 0 && `Spot: reclaim floor ${spot.toExponential(1)} assumed (<5 %/month, 300 s replace)`),
        note(!PLAN_SPECS[c.plan] && `unknown plan ${c.plan}, treated as On-Demand`),
        note("PPS and conntrack allowances not published: not modelled"),
      );
    };
  },
};
