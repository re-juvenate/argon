import { Unit, type Bytes, type CreditState, type Mbps, type ModelTier, type Seconds, type ThroughputContext, type ThroughputResult } from "../types/math";

// ---- unit constructors and conversions (throughput is always Mbps) ----

export const mbps = (value: number): Mbps => ({ type: Unit.Mbps, value });
export const bytes = (value: number): Bytes => ({ type: Unit.Bytes, value });
export const seconds = (value: number): Seconds => ({ type: Unit.Seconds, value });

export const KiB = 1024;
export const MiB = 1024 * 1024;

export function toMbps(rps: number, avgBytes: Bytes): Mbps {
  return mbps((rps * avgBytes.value * 8) / 1e6);
}

export function toRps(m: Mbps, avgBytes: Bytes): number {
  return (m.value * 1e6) / (8 * avgBytes.value);
}

export function gbpsToMbps(gbps: number): Mbps {
  return mbps(gbps * 1000);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const isFinite = (m: Mbps): boolean => Number.isFinite(m.value);

// ---- config resolution ----

export function resolve<C extends object>(defaults: Required<C>, config: C | undefined): Required<C> {
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, v] of Object.entries(config ?? {})) if (v !== undefined) out[k] = v;
  return out as Required<C>;
}

// ---- socket aggregation ----

export function offeredMbps(ctx: ThroughputContext): Mbps {
  return mbps(ctx.inputsMbps.reduce((acc, m) => acc + m.value, 0));
}

// ---- result pipeline: pure steps over ThroughputResult ----

export type Step = (r: ThroughputResult) => ThroughputResult;

export function pipe(initial: ThroughputResult, ...steps: Step[]): ThroughputResult {
  return steps.reduce((r, step) => step(r), initial);
}

// Start a result from the context's offered load (or an explicit override for sources).
export function offered(ctx: ThroughputContext, model: ModelTier, override?: Mbps): ThroughputResult {
  const o = override ?? offeredMbps(ctx);
  return {
    capacityMbps: mbps(Infinity),
    offeredMbps: o,
    servedMbps: o,
    overflowMbps: mbps(0),
    utilization: 0,
    outputsMbps: [],
    model,
    notes: [],
  };
}

// Apply a capacity: served = min(offered, capacity).
export function cap(capacityMbps: Mbps): Step {
  return (r) => {
    const s = Math.min(r.offeredMbps.value, capacityMbps.value);
    return {
      ...r,
      capacityMbps,
      servedMbps: mbps(s),
      overflowMbps: mbps(Math.max(0, r.offeredMbps.value - s)),
      utilization: isFinite(capacityMbps) && capacityMbps.value > 0 ? r.offeredMbps.value / capacityMbps.value : 0,
    };
  };
}

// Override served (for models whose directions saturate independently).
export function served(servedMbps: Mbps): Step {
  return (r) => ({ ...r, servedMbps, overflowMbps: mbps(Math.max(0, r.offeredMbps.value - servedMbps.value)) });
}

export function splitEven(outputCount: number): Step {
  return (r) => ({
    ...r,
    outputsMbps: outputCount > 0 ? Array.from({ length: outputCount }, () => mbps(r.servedMbps.value / outputCount)) : [],
  });
}

export function splitWeighted(weights: readonly number[]): Step {
  return (r) => {
    const total = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
    if (total <= 0) return splitEven(weights.length)(r);
    return { ...r, outputsMbps: weights.map((w) => mbps((r.servedMbps.value * Math.max(0, w)) / total)) };
  };
}

export function scaleOutputs(factor: number): Step {
  return (r) => ({ ...r, outputsMbps: r.outputsMbps.map((m) => mbps(m.value * factor)) });
}

export function note(text: string | false | undefined): Step {
  return (r) => (text ? { ...r, notes: [...r.notes, text] } : r);
}

export function tier(model: ModelTier): Step {
  return (r) => ({ ...r, model });
}

// ---- burstable bandwidth (EC2 / Fargate network I/O credits) ----
// Bucket sized so a full bucket sustains `burst` for `burstSeconds`; credits refill whenever
// demand is below baseline. Source: aws-simulation-research.md §1.1 / §7.

export interface CreditBucketInput {
  baselineMbps: Mbps;
  burstMbps: Mbps;
  demandMbps: Mbps;
  burstSeconds: Seconds;
  dt: Seconds;
}

export function newCreditState(baselineMbps: Mbps, burstMbps: Mbps, burstSeconds: Seconds): CreditState {
  return { creditsMbit: Math.max(0, burstMbps.value - baselineMbps.value) * burstSeconds.value };
}

// Returns the bandwidth available this tick and mutates `state`.
export function creditBucket(input: CreditBucketInput, state: CreditState): Mbps {
  const { baselineMbps, burstMbps, demandMbps, burstSeconds, dt } = input;
  const bucketMax = Math.max(0, burstMbps.value - baselineMbps.value) * burstSeconds.value;
  const available = state.creditsMbit > 0 ? burstMbps : baselineMbps;
  const used = Math.min(demandMbps.value, available.value);
  state.creditsMbit = clamp(state.creditsMbit + (baselineMbps.value - used) * dt.value, 0, bucketMax);
  return available;
}

// ---- tiny CSV reader for the node data files (imported with `?raw`) ----

export function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const split = (line: string) => line.split(",").map((cell) => cell.trim().replace(/^"(.*)"$/, "$1"));
  const header = split(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = cells[i] ?? "";
    });
    return row;
  });
}

export function num(value: string | undefined, fallback = NaN): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) ? n : fallback;
}
