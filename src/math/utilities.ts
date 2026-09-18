import {
  Unit,
  type Bytes,
  type CreditState,
  DropKind,
  type DropCause,
  type DropContext,
  type DropResult,
  type LatencyResult,
  type Mbps,
  type Milliseconds,
  type ModelTier,
  type RampState,
  type Ratio,
  type Seconds,
  type Stamped,
  type ThroughputContext,
  type ThroughputResult,
} from "../types/math";

// ---- unit constructors and conversions (throughput is always Mbps, latency always ms) ----

export const mbps = (value: number): Mbps => ({ type: Unit.Mbps, value });
export const bytes = (value: number): Bytes => ({ type: Unit.Bytes, value });
export const seconds = (value: number): Seconds => ({ type: Unit.Seconds, value });
export const ms = (value: number): Milliseconds => ({ type: Unit.Milliseconds, value });
export const ratio = (value: number): Ratio => ({ type: Unit.Ratio, value: Number.isNaN(value) ? 0 : clamp(value, 0, 1) });

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

// request size: the edge's, else the node's assumption
export const sizeOf = (ctx: ThroughputContext, fallback: Bytes): Bytes => ctx.avgBytes ?? fallback;

// AWS SDK default maxAttempts = 3 → 2 retries; browsers do not retry 5xx
export const SDK_RETRIES = 2;
export const CLIENT_RETRIES = 0;

// ---- result pipeline: pure steps over a result (throughput or latency) ----

export type Step<R = ThroughputResult> = (r: R) => R;

export function pipe<R>(initial: R, ...steps: Step<R>[]): R {
  return steps.reduce((r, step) => step(r), initial);
}

type Annotated = { notes: readonly string[]; model: ModelTier };

export function note<R extends Annotated>(text: string | false | undefined): Step<R> {
  return (r) => (text ? { ...r, notes: [...r.notes, text] } : r);
}

export function tier<R extends Annotated>(model: ModelTier): Step<R> {
  return (r) => ({ ...r, model });
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

// ---- tick stamps: stateful models advance once per tick; readers trust only same-tick state ----

// true when `state` was already advanced for `ctx.tick` (untracked ticks never match)
export const advanced = (state: Stamped, ctx: ThroughputContext): boolean => ctx.tick !== undefined && state.tick === ctx.tick;

// `state` if it is usable for this tick (advanced this tick, or ticks untracked), else undefined
export const current = <S extends Stamped>(state: S | undefined, ctx: ThroughputContext): S | undefined =>
  state !== undefined && (ctx.tick === undefined || state.tick === ctx.tick) ? state : undefined;

// ---- ramp: capacity that scales with a rate and a delay ----

export interface RampSpec {
  floor: number;
  ceiling: number;
  // units per second; Infinity = step
  rateUp: number;
  rateDown: number;
  // first-order lag instead of a fixed rate: amount = gap · dt / tauS
  tauS?: number;
  // sustained demand before scaling (alarm evaluation periods)
  delayUpS: number;
  delayDownS: number;
  // ordered capacity joins after this (launch + health checks)
  launchS: number;
  cooldownS: number;
}

export function newRampState(level: number): RampState {
  return { level, pending: [], timeS: 0, aboveS: 0, belowS: 0, lastScaleS: -Infinity };
}

// Advance once per tick toward `desired`; returns the capacity in service this tick.
export function ramp(state: RampState, desired: number, spec: RampSpec, ctx: ThroughputContext): number {
  if (ctx.dt === undefined || advanced(state, ctx)) return state.level;
  const dt = ctx.dt.value;
  state.timeS += dt;
  state.tick = ctx.tick;
  state.pending = state.pending.filter((p) => {
    if (p.readyAtS > state.timeS) return true;
    state.level += p.amount;
    return false;
  });
  const ordered = state.level + state.pending.reduce((acc, p) => acc + p.amount, 0);
  const target = clamp(desired, spec.floor, spec.ceiling);
  state.aboveS = target > ordered ? state.aboveS + dt : 0;
  state.belowS = target < state.level ? state.belowS + dt : 0;
  const cool = state.timeS - state.lastScaleS >= spec.cooldownS;
  const step = (gap: number, rate: number) => (spec.tauS !== undefined ? (gap * dt) / spec.tauS : Math.min(gap, rate * dt));
  if (target > ordered && state.aboveS >= spec.delayUpS && cool) {
    const amount = step(target - ordered, spec.rateUp);
    if (amount > 0) {
      if (spec.launchS > 0) state.pending.push({ readyAtS: state.timeS + spec.launchS, amount });
      else state.level += amount;
      state.lastScaleS = state.timeS;
    }
  } else if (target < state.level && state.belowS >= spec.delayDownS && cool) {
    state.level -= step(state.level - target, spec.rateDown);
    state.lastScaleS = state.timeS;
  }
  state.level = clamp(state.level, spec.floor, spec.ceiling);
  return state.level;
}

// ---- burstable bandwidth (EC2 / Fargate network I/O credits) ----

export interface CreditBucketInput {
  baselineMbps: Mbps;
  burstMbps: Mbps;
  demandMbps: Mbps;
  burstSeconds: Seconds;
  ctx: ThroughputContext;
}

export function newCreditState(baselineMbps: Mbps, burstMbps: Mbps, burstSeconds: Seconds): CreditState {
  return { creditsMbit: Math.max(0, burstMbps.value - baselineMbps.value) * burstSeconds.value };
}

// Bandwidth granted this tick; mutates `state` once per tick (repeat calls return the grant).
export function creditBucket(input: CreditBucketInput, state: CreditState): Mbps {
  const { baselineMbps, burstMbps, demandMbps, burstSeconds, ctx } = input;
  if (advanced(state, ctx) && state.availableMbps) return state.availableMbps;
  const bucketMax = Math.max(0, burstMbps.value - baselineMbps.value) * burstSeconds.value;
  const available = state.creditsMbit > 0 ? burstMbps : baselineMbps;
  const used = Math.min(demandMbps.value, available.value);
  state.creditsMbit = clamp(state.creditsMbit + (baselineMbps.value - used) * (ctx.dt?.value ?? 0), 0, bucketMax);
  state.availableMbps = available;
  state.tick = ctx.tick;
  return available;
}

// ---- latency: queueing (reduced-formulas-latency.md §2.1) ----

// serialization delay of one message
export function xferMs(size: Bytes, bw: Mbps): Milliseconds {
  return ms(Number.isFinite(bw.value) && bw.value > 0 ? (size.value * 8) / bw.value / 1e3 : 0);
}

// P(arrival waits) in M/M/c with offered load a = λ/μ; running product so large c doesn't overflow
export function erlangC(c: number, a: number): number {
  if (c <= 0 || a <= 0) return 0;
  const rho = a / c;
  if (rho >= 1) return 1;
  let term = 1;
  let sum = 1;
  for (let k = 1; k < c; k++) {
    term *= a / k;
    sum += term;
  }
  term *= a / c;
  const last = term / (1 - rho);
  return last / (sum + last);
}

export interface QueueWait {
  rho: number;
  pWait: number;
  meanMs: Milliseconds;
  p50Ms: Milliseconds;
  // Infinity when ρ ≥ 1
  p99Ms: Milliseconds;
}

// M/M/c wait; λ, μ (per server) in 1/s. Quantiles from P(Wq > t) = C · e^{−(cμ−λ)t}.
export function mmc(lambda: number, mu: number, c: number): QueueWait {
  const servers = Math.max(1, c);
  if (lambda <= 0 || !(mu > 0)) return { rho: 0, pWait: 0, meanMs: ms(0), p50Ms: ms(0), p99Ms: ms(0) };
  const rho = lambda / (servers * mu);
  if (rho >= 1) return { rho, pWait: 1, meanMs: ms(Infinity), p50Ms: ms(Infinity), p99Ms: ms(Infinity) };
  const pWait = erlangC(servers, lambda / mu);
  const drain = servers * mu - lambda;
  const quantile = (q: number) => (pWait > q ? (Math.log(pWait / q) / drain) * 1000 : 0);
  return { rho, pWait, meanMs: ms((pWait / drain) * 1000), p50Ms: ms(quantile(0.5)), p99Ms: ms(quantile(0.01)) };
}

export interface TailBranch {
  share: number;
  p99Ms: Milliseconds;
}

// p99 of a mixture: slowest branch carrying ≥ 1 % (else the largest branch)
export function tailMix(branches: readonly TailBranch[]): Milliseconds {
  const live = branches.filter((b) => b.share >= 0.01);
  if (live.length > 0) return ms(Math.max(...live.map((b) => b.p99Ms.value)));
  const largest = branches.reduce<TailBranch | undefined>((best, b) => (best === undefined || b.share > best.share ? b : best), undefined);
  return largest?.p99Ms ?? ms(0);
}

// ---- latency pipeline steps ----

export type LatencyStep = Step<LatencyResult>;

export function start(serviceMs: Milliseconds, model: ModelTier): LatencyResult {
  return {
    serviceMs,
    waitMs: ms(0),
    p50Ms: serviceMs,
    p99Ms: serviceMs,
    tailMs: serviceMs,
    utilization: 0,
    servers: 0,
    model,
    notes: [],
  };
}

export function wait(q: QueueWait, servers: number): LatencyStep {
  return (r) => ({
    ...r,
    waitMs: q.p99Ms,
    p50Ms: ms(r.serviceMs.value + q.p50Ms.value),
    p99Ms: ms(r.serviceMs.value + q.p99Ms.value),
    tailMs: ms(r.serviceMs.value + q.p99Ms.value),
    utilization: q.rho,
    servers,
  });
}

export function mix(branches: readonly (TailBranch & { p50Ms: Milliseconds })[]): LatencyStep {
  return (r) => {
    const total = branches.reduce((acc, b) => acc + b.share, 0);
    const p50 = total > 0 ? branches.reduce((acc, b) => acc + (b.share / total) * b.p50Ms.value, 0) : r.p50Ms.value;
    const p99 = tailMix(branches);
    return { ...r, p50Ms: ms(p50), p99Ms: p99, tailMs: p99 };
  };
}

// set p99 directly (measured tables, bimodal models); keeps tailMs in step
export function tail(p99Ms: Milliseconds): LatencyStep {
  return (r) => ({ ...r, p99Ms, tailMs: p99Ms });
}

// only p99 is known downstream, so p50 stays the node's own
export function downstream(p99Ms: Milliseconds | undefined): LatencyStep {
  return (r) => (p99Ms === undefined ? r : { ...r, p99Ms: ms(r.p99Ms.value + p99Ms.value), tailMs: ms(r.tailMs.value + p99Ms.value) });
}

// overloaded → p99 is the documented timeout, not ∞ (tailMs keeps the uncapped value)
export function capTimeout(timeoutMs: Milliseconds): LatencyStep {
  return (r) => ({
    ...r,
    p99Ms: ms(Math.min(r.p99Ms.value, timeoutMs.value)),
    p50Ms: ms(Math.min(r.p50Ms.value, timeoutMs.value)),
    notes: r.p99Ms.value > timeoutMs.value ? [...r.notes, `p99 capped at ${timeoutMs.value} ms timeout`] : r.notes,
  });
}

// ---- drop / loss (reduced-formulas-drop.md §2.1) ----

// independent stages
export function combine(rates: readonly Ratio[]): Ratio {
  return ratio(1 - rates.reduce((acc, r) => acc * (1 - r.value), 1));
}

// survives R independent retries
export function retried(d: Ratio, retries: number): Ratio {
  return ratio(Math.pow(d.value, Math.max(0, retries) + 1));
}

// P(latency > timeout) from the exponential tail anchored at p99: 0.01^(T / p99)
export function tailExceed(p99: Milliseconds | undefined, timeout: Milliseconds): Ratio {
  if (p99 === undefined || !(p99.value > 0)) return ratio(0);
  if (!Number.isFinite(p99.value)) return ratio(1);
  return ratio(Math.pow(0.01, timeout.value / p99.value));
}

export function meanRatio(values: readonly Ratio[] | undefined): Ratio {
  if (!values || values.length === 0) return ratio(0);
  return ratio(values.reduce((acc, r) => acc + r.value, 0) / values.length);
}

// ---- drop pipeline steps ----

export type DropStep = Step<DropResult>;

export function rawDropFrom(offered: Mbps, served: Mbps): Ratio {
  return ratio(offered.value > 0 ? 1 - Math.min(offered.value, served.value) / offered.value : 0);
}

export function startDrop(ctx: DropContext, capacityMbps: Mbps, model: ModelTier): DropResult {
  const offered = offeredMbps(ctx);
  return startDropServed(offered, mbps(Math.min(offered.value, capacityMbps.value)), model);
}

// for served ≠ min(offered, capacity) (independent pools)
export function startDropServed(offered: Mbps, served: Mbps, model: ModelTier): DropResult {
  return {
    offeredMbps: offered,
    droppedMbps: mbps(0),
    rawDrop: rawDropFrom(offered, served),
    dropRate: ratio(0),
    causes: [],
    model,
    notes: [],
  };
}

export function cause(kind: DropKind, rate: Ratio): DropStep {
  return (r) => {
    if (rate.value <= 0) return r;
    const causes: DropCause[] = [...r.causes, { kind, rate }];
    const dropRate = combine(causes.map((c) => c.rate));
    return { ...r, causes, dropRate, droppedMbps: mbps(r.offeredMbps.value * dropRate.value) };
  };
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
