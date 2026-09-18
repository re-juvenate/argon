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


export interface ThroughputContext {
  // one entry per input socket; [] for source nodes
  inputsMbps: readonly Mbps[];
  outputCount: number;
  dt?: Seconds;
  // only trust state advanced for the same tick
  tick?: number;
}

export interface Stamped {
  tick?: number;
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
  notes: readonly string[];
}

export type Evaluate = (ctx: ThroughputContext) => ThroughputResult;

// Every service module exports one of these. `defaults` holds what AWS asks for at setup;
export interface ServiceModel<Config extends object, State = never> {
  readonly defaults: Required<Config>;
  capacity(config?: Config): Mbps;
  newState?(config?: Config): State;
  evaluate(config?: Config, state?: State): Evaluate;
}

export interface CreditState extends Stamped {
  creditsMbit: number;
  availableMbps?: Mbps;
}

// ---- latency (p99) ----

export interface LatencyContext extends ThroughputContext {
  downstreamMs?: readonly Milliseconds[];
}

export interface LatencyResult {
  serviceMs: Milliseconds;
  waitMs: Milliseconds;
  p50Ms: Milliseconds;
  p99Ms: Milliseconds;
  utilization: number;
  // c in M/M/c
  servers: number;
  model: ModelTier;
  notes: readonly string[];
}

export type EvaluateLatency = (ctx: LatencyContext) => LatencyResult;

export interface LatencyModel<Config extends object, State = never> {
  readonly defaults: Required<Config>;
  evaluate(config?: Config, state?: State): EvaluateLatency;
}

export enum DropKind {
  Overflow = "overflow",
  Throttle = "throttle",
  Timeout = "timeout",
  Refused = "refused",
  Unavailable = "unavailable",
  Reclaimed = "reclaimed",
  Downstream = "downstream",
}

export interface DropContext extends LatencyContext {
  downstreamDrop?: readonly Ratio[];
}

export interface DropCause {
  kind: DropKind;
  rate: Ratio;
}

export interface DropResult {
  offeredMbps: Mbps;
  droppedMbps: Mbps;
  rawDrop: Ratio;
  dropRate: Ratio;
  causes: readonly DropCause[];
  model: ModelTier;
  notes: readonly string[];
}

export type EvaluateDrop = (ctx: DropContext) => DropResult;

export interface DropModel<Config extends object, State = never> {
  readonly defaults: Required<Config>;
  evaluate(config?: Config, state?: State): EvaluateDrop;
}
