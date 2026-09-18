// Shared types for src/math. Throughput is Mbps, latency is ms, drop/loss is a ratio in [0, 1].
// Patterns: .references/ts-context-patterns.md ; specs: .references/reduced-formulas-throughput.md §2,
// .references/reduced-formulas-latency.md §2, .references/reduced-formulas-drop.md §2

// ---- units: same tagged-value shape as PropertyValue in ./nodes.ts ----

export enum Unit {
  Mbps = "Mbps",
  Bytes = "Bytes",
  Seconds = "Seconds",
  Milliseconds = "Milliseconds",
  Ratio = "Ratio",
}

export type Quantity<U extends Unit> = { type: U; value: number };

export type Mbps = Quantity<Unit.Mbps>;
export type Bytes = Quantity<Unit.Bytes>;
export type Seconds = Quantity<Unit.Seconds>;
export type Milliseconds = Quantity<Unit.Milliseconds>;
// dimensionless fraction in [0, 1]
export type Ratio = Quantity<Unit.Ratio>;

// ---- model tier ----
//  Measured  – documented/measured function applied to the node's own data
//  Estimated – parameters derived from sockets, their throughput, or other attributes
//  Assumed   – no accurate model; a stated assumption behind a knob
export enum ModelTier {
  Measured = "measured",
  Estimated = "estimated",
  Assumed = "assumed",
}

export enum ServiceType {
  EC2 = "ec2",
  ECS = "ecs",
  ASG = "asg",
  LB = "lb",
  SQS = "sqs",
  Lambda = "lambda",
  S3 = "s3",
  CloudFront = "cloudfront",
  Route53 = "route53",
  Aurora = "aurora",
}

// ---- Reader: context varies per tick, config is bound once ----

export interface ThroughputContext {
  // one entry per input socket; [] for source nodes
  inputsMbps: readonly Mbps[];
  // number of output sockets the served throughput is split across
  outputCount: number;
  // tick length for stateful models (credit buckets, ramps); omit for steady state
  dt?: Seconds;
}

export interface ThroughputResult {
  // Infinity when the service has no cap of its own
  capacityMbps: Mbps;
  offeredMbps: Mbps;
  servedMbps: Mbps;
  overflowMbps: Mbps;
  // offered / capacity; 0 when capacity is Infinity
  utilization: number;
  // served throughput distributed over the output sockets
  outputsMbps: readonly Mbps[];
  model: ModelTier;
  // which fallback / estimate was used, for the UI
  notes: readonly string[];
}

export type Evaluate = (ctx: ThroughputContext) => ThroughputResult;

// Every service module exports one of these. `defaults` holds what AWS asks for at setup;
// fixed AWS numbers and app-level assumptions are module constants the model closes over.
export interface ServiceModel<Config extends object, State = never> {
  readonly defaults: Required<Config>;
  capacity(config?: Config): Mbps;
  newState?(config?: Config): State;
  evaluate(config?: Config, state?: State): Evaluate;
}

// Persistent per-node state for burstable network models (EC2 / Fargate)
export interface CreditState {
  // remaining network I/O credits in Mbit
  creditsMbit: number;
  // bandwidth the last tick granted; creditsMbit alone is one tick late at the burst boundary
  availableMbps?: Mbps;
}

// ---- latency (p99) ----

export interface LatencyContext extends ThroughputContext {
  // p99 of the subtree behind each output socket, when the graph walker has it
  downstreamMs?: readonly Milliseconds[];
}

export interface LatencyResult {
  // load-independent: processing + transfer + fixed overheads
  serviceMs: Milliseconds;
  // p99 queueing wait
  waitMs: Milliseconds;
  p50Ms: Milliseconds;
  // Infinity when unbounded
  p99Ms: Milliseconds;
  // of the queueing resource; 0 when there is none
  utilization: number;
  // c in M/M/c
  servers: number;
  model: ModelTier;
  notes: readonly string[];
}

export type EvaluateLatency = (ctx: LatencyContext) => LatencyResult;

// `defaults` and `state` are the throughput model's; state is read, never mutated.
export interface LatencyModel<Config extends object, State = never> {
  readonly defaults: Required<Config>;
  evaluate(config?: Config, state?: State): EvaluateLatency;
}

// ---- drop / loss ----

export enum DropKind {
  // beyond capacity, undelivered (ENA drop, overloaded tasks, edge throttle)
  Overflow = "overflow",
  // 429, ThrottlingException, 503 SlowDown
  Throttle = "throttle",
  // ALB / CloudFront 504
  Timeout = "timeout",
  // max_connections, NLB port allocation, 503 no targets
  Refused = "refused",
  // availability floor
  Unavailable = "unavailable",
  // Spot
  Reclaimed = "reclaimed",
  // forwarded from the nodes behind the output sockets
  Downstream = "downstream",
}

export interface DropContext extends LatencyContext {
  // one per output socket, when the graph walker has it
  downstreamDrop?: readonly Ratio[];
}

export interface DropCause {
  kind: DropKind;
  rate: Ratio;
}

export interface DropResult {
  offeredMbps: Mbps;
  droppedMbps: Mbps;
  // overflow / offered, before retries or cache shielding
  rawDrop: Ratio;
  // 1 − Π(1 − cause)
  dropRate: Ratio;
  causes: readonly DropCause[];
  model: ModelTier;
  notes: readonly string[];
}

export type EvaluateDrop = (ctx: DropContext) => DropResult;

// Same contract as LatencyModel.
export interface DropModel<Config extends object, State = never> {
  readonly defaults: Required<Config>;
  evaluate(config?: Config, state?: State): EvaluateDrop;
}
