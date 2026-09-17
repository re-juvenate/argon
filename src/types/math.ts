// Shared throughput types for src/math. All throughput values are Mbps.
// Patterns: .references/ts-context-patterns.md ; spec: .references/reduced-formulas-throughput.md §2

// ---- units: same tagged-value shape as PropertyValue in ./nodes.ts ----

export enum Unit {
  Mbps = "Mbps",
  Bytes = "Bytes",
  Seconds = "Seconds",
}

export type Quantity<U extends Unit> = { type: U; value: number };

export type Mbps = Quantity<Unit.Mbps>;
export type Bytes = Quantity<Unit.Bytes>;
export type Seconds = Quantity<Unit.Seconds>;

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
}
