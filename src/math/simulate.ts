import {
  ServiceType,
  type DropContext,
  type DropModel,
  type DropResult,
  type Evaluate,
  type EvaluateDrop,
  type EvaluateLatency,
  type LatencyContext,
  type LatencyModel,
  type LatencyResult,
  type Mbps,
  type ServiceModel,
  type ThroughputContext,
  type ThroughputResult,
} from "../types/math";
import { model as ec2 } from "./ec2/throughput";
import { model as ecs } from "./ecs/throughput";
import { model as asg } from "./asg/throughput";
import { model as lb } from "./lb/throughput";
import { model as sqs } from "./sqs/throughput";
import { model as lambda } from "./lambda/throughput";
import { model as s3 } from "./s3/throughput";
import { model as cloudfront } from "./cloudfront/throughput";
import { model as route53 } from "./route53/throughput";
import { model as aurora } from "./aurora/throughput";
import { model as client } from "./client/throughput";
import { model as region } from "./region/throughput";
import { model as ec2Latency } from "./ec2/latency";
import { model as ecsLatency } from "./ecs/latency";
import { model as asgLatency } from "./asg/latency";
import { model as lbLatency } from "./lb/latency";
import { model as sqsLatency } from "./sqs/latency";
import { model as lambdaLatency } from "./lambda/latency";
import { model as s3Latency } from "./s3/latency";
import { model as cloudfrontLatency } from "./cloudfront/latency";
import { model as route53Latency } from "./route53/latency";
import { model as auroraLatency } from "./aurora/latency";
import { model as clientLatency } from "./client/latency";
import { model as regionLatency } from "./region/latency";
import { model as ec2Drop } from "./ec2/drop";
import { model as ecsDrop } from "./ecs/drop";
import { model as asgDrop } from "./asg/drop";
import { model as lbDrop } from "./lb/drop";
import { model as sqsDrop } from "./sqs/drop";
import { model as lambdaDrop } from "./lambda/drop";
import { model as s3Drop } from "./s3/drop";
import { model as cloudfrontDrop } from "./cloudfront/drop";
import { model as route53Drop } from "./route53/drop";
import { model as auroraDrop } from "./aurora/drop";
import { model as clientDrop } from "./client/drop";
import { model as regionDrop } from "./region/drop";

// Per-service registries, one per objective (throughput, latency, drop), keyed by ServiceType.
// Registry instead of a switch: `satisfies` makes it exhaustive over ServiceType while keeping
// each entry's precise Config/State types (ts-context-patterns.md §2).
export const THROUGHPUT_MODELS = {
  [ServiceType.EC2]: ec2,
  [ServiceType.ECS]: ecs,
  [ServiceType.ASG]: asg,
  [ServiceType.LB]: lb,
  [ServiceType.SQS]: sqs,
  [ServiceType.Lambda]: lambda,
  [ServiceType.S3]: s3,
  [ServiceType.CloudFront]: cloudfront,
  [ServiceType.Route53]: route53,
  [ServiceType.Aurora]: aurora,
  [ServiceType.Client]: client,
  [ServiceType.Region]: region,
} satisfies Record<ServiceType, ServiceModel<object, unknown>>;

export type ServiceConfig<T extends ServiceType> = Parameters<(typeof THROUGHPUT_MODELS)[T]["evaluate"]>[0];
export type ServiceState<T extends ServiceType> = Parameters<(typeof THROUGHPUT_MODELS)[T]["evaluate"]>[1];

export function throughputModel<T extends ServiceType>(type: T): (typeof THROUGHPUT_MODELS)[T] {
  return THROUGHPUT_MODELS[type];
}

export function throughputCapacity<T extends ServiceType>(type: T, config?: ServiceConfig<T>): Mbps {
  return (THROUGHPUT_MODELS[type] as ServiceModel<object, unknown>).capacity(config);
}

// Bind config (and optional state) once → Reader over the per-tick context.
export function evaluateThroughput<T extends ServiceType>(type: T, config?: ServiceConfig<T>, state?: ServiceState<T>): Evaluate {
  return (THROUGHPUT_MODELS[type] as ServiceModel<object, unknown>).evaluate(config, state);
}

// One-shot steady-state evaluation.
export function throughputAt<T extends ServiceType>(type: T, ctx: ThroughputContext, config?: ServiceConfig<T>): ThroughputResult {
  return evaluateThroughput(type, config)(ctx);
}

// ---- latency (p99) ----

export const LATENCY_MODELS = {
  [ServiceType.EC2]: ec2Latency,
  [ServiceType.ECS]: ecsLatency,
  [ServiceType.ASG]: asgLatency,
  [ServiceType.LB]: lbLatency,
  [ServiceType.SQS]: sqsLatency,
  [ServiceType.Lambda]: lambdaLatency,
  [ServiceType.S3]: s3Latency,
  [ServiceType.CloudFront]: cloudfrontLatency,
  [ServiceType.Route53]: route53Latency,
  [ServiceType.Aurora]: auroraLatency,
  [ServiceType.Client]: clientLatency,
  [ServiceType.Region]: regionLatency,
} satisfies Record<ServiceType, LatencyModel<object, unknown>>;

export function latencyModel<T extends ServiceType>(type: T): (typeof LATENCY_MODELS)[T] {
  return LATENCY_MODELS[type];
}

export function evaluateLatency<T extends ServiceType>(type: T, config?: ServiceConfig<T>, state?: ServiceState<T>): EvaluateLatency {
  return (LATENCY_MODELS[type] as LatencyModel<object, unknown>).evaluate(config, state);
}

export function latencyAt<T extends ServiceType>(type: T, ctx: LatencyContext, config?: ServiceConfig<T>): LatencyResult {
  return evaluateLatency(type, config)(ctx);
}

// ---- drop / loss ----

export const DROP_MODELS = {
  [ServiceType.EC2]: ec2Drop,
  [ServiceType.ECS]: ecsDrop,
  [ServiceType.ASG]: asgDrop,
  [ServiceType.LB]: lbDrop,
  [ServiceType.SQS]: sqsDrop,
  [ServiceType.Lambda]: lambdaDrop,
  [ServiceType.S3]: s3Drop,
  [ServiceType.CloudFront]: cloudfrontDrop,
  [ServiceType.Route53]: route53Drop,
  [ServiceType.Aurora]: auroraDrop,
  [ServiceType.Client]: clientDrop,
  [ServiceType.Region]: regionDrop,
} satisfies Record<ServiceType, DropModel<object, unknown>>;

export function dropModel<T extends ServiceType>(type: T): (typeof DROP_MODELS)[T] {
  return DROP_MODELS[type];
}

// latency and drop only read the throughput state: run the throughput tick first
export function evaluateDrop<T extends ServiceType>(type: T, config?: ServiceConfig<T>, state?: ServiceState<T>): EvaluateDrop {
  return (DROP_MODELS[type] as DropModel<object, unknown>).evaluate(config, state);
}

export function dropAt<T extends ServiceType>(type: T, ctx: DropContext, config?: ServiceConfig<T>): DropResult {
  return evaluateDrop(type, config)(ctx);
}
