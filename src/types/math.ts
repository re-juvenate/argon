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
  EBS = "ebs",
  EFS = "efs",
  Client = "client",
  Region = "region",
  VPC = "vpc",
}

export interface ThroughputContext {
  inputsMbps: readonly Mbps[];
  outputCount: number;
  dt?: Seconds;
  tick?: number;
  avgBytes?: Bytes;
}

export interface Stamped {
  tick?: number;
}

export interface RampState extends Stamped {
  level: number;
  pending: { readyAtS: number; amount: number }[];
  timeS: number;
  aboveS: number;
  belowS: number;
  lastScaleS: number;
}

export interface ThroughputResult {
  capacityMbps: Mbps;
  offeredMbps: Mbps;
  servedMbps: Mbps;
  overflowMbps: Mbps;
  utilization: number;
  outputsMbps: readonly Mbps[];
  model: ModelTier;
  notes: readonly string[];
}

export type Evaluate = (ctx: ThroughputContext) => ThroughputResult;

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

export interface LatencyContext extends ThroughputContext {
  downstreamMs?: readonly Milliseconds[];
}

export interface LatencyResult {
  serviceMs: Milliseconds;
  waitMs: Milliseconds;
  p50Ms: Milliseconds;
  p99Ms: Milliseconds;
  tailMs: Milliseconds;
  utilization: number;
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
