import { ModelTier, type Mbps, type ServiceModel } from "../../types/math";
import { bytes, cap, isFinite, KiB, mbps, note, offered, offeredMbps, pipe, resolve, splitEven, toRps } from "../utilities";

// Elastic Load Balancing. At setup you choose ALB vs NLB and, optionally, an LCU
// reservation; everything else auto-scales. LCU usage is estimated from the offered
// throughput with fixed traffic-shape assumptions. 1 LCU = 1 GB/h = 2.222 Mbps.
// Spec: .references/reduced-formulas-throughput.md §3.4

export enum LBKind {
  ALB = "alb",
  NLB = "nlb",
}

export interface LBConfig {
  kind?: LBKind;
  // 0 = no reservation (capacity unbounded)
  reservedLcu?: number;
}

export const LB_DEFAULTS: Required<LBConfig> = { kind: LBKind.ALB, reservedLcu: 0 };

export const LCU_MBPS = mbps(8000 / 3600);
export const ALB_LCU = { newConnPerSec: 25, activeConnPerMin: 3000, ruleEvalsPerSec: 1000 } as const;
export const NLB_LCU = { newConnPerSec: 800, activeConnPerMin: 100000 } as const;

// Assumed traffic shape (not something AWS asks for)
export const LB_ASSUMED = {
  avgBytes: bytes(50 * KiB),
  keepAliveRatio: 0.9,
  connSeconds: 1,
  rulesPerRequest: 1,
} as const;

export interface LcuBreakdown {
  newConnLcu: number;
  activeConnLcu: number;
  bytesLcu: number;
  rulesLcu: number;
  lcu: number;
}

export function lcuFromThroughput(m: Mbps, kind: LBKind = LB_DEFAULTS.kind): LcuBreakdown {
  const a = LB_ASSUMED;
  const rps = toRps(m, a.avgBytes);
  // NewConnectionCount counts client→LB and LB→target
  const newCps = rps * (1 - a.keepAliveRatio) * 2;
  const active = rps * a.connSeconds;
  const dims = kind === LBKind.NLB ? NLB_LCU : ALB_LCU;
  const newConnLcu = newCps / dims.newConnPerSec;
  const activeConnLcu = active / dims.activeConnPerMin;
  const bytesLcu = m.value / LCU_MBPS.value;
  const rulesLcu = kind === LBKind.ALB ? (rps * a.rulesPerRequest) / ALB_LCU.ruleEvalsPerSec : 0;
  return { newConnLcu, activeConnLcu, bytesLcu, rulesLcu, lcu: Math.max(newConnLcu, activeConnLcu, bytesLcu, rulesLcu) };
}

// Mbps still available under a reservation once connection/rule dimensions are paid for.
export function reservedCapacity(m: Mbps, config?: LBConfig): Mbps {
  const c = resolve(LB_DEFAULTS, config);
  if (c.reservedLcu <= 0) return mbps(Infinity);
  const b = lcuFromThroughput(m, c.kind);
  return mbps(Math.max(0, c.reservedLcu - Math.max(b.newConnLcu, b.activeConnLcu, b.rulesLcu)) * LCU_MBPS.value);
}

export const model: ServiceModel<LBConfig> = {
  defaults: LB_DEFAULTS,

  // load-independent ceiling: all reserved LCUs spent on bytes
  capacity(config) {
    const c = resolve(LB_DEFAULTS, config);
    return c.reservedLcu > 0 ? mbps(c.reservedLcu * LCU_MBPS.value) : mbps(Infinity);
  },

  evaluate(config) {
    const c = resolve(LB_DEFAULTS, config);
    return (ctx) => {
      const o = offeredMbps(ctx);
      const capacity = reservedCapacity(o, c);
      const b = lcuFromThroughput(o, c.kind);
      return pipe(
        offered(ctx, ModelTier.Estimated),
        cap(capacity),
        splitEven(ctx.outputCount),
        note(`consumes ${b.lcu.toFixed(2)} LCU (bytes ${b.bytesLcu.toFixed(2)}, new ${b.newConnLcu.toFixed(2)}, active ${b.activeConnLcu.toFixed(2)}, rules ${b.rulesLcu.toFixed(2)})`),
        note(!isFinite(capacity) && "auto-scaling: no reservation, capacity unbounded"),
      );
    };
  },
};
