import { ServiceType, type Evaluate, type Mbps, type ServiceModel, type ThroughputContext, type ThroughputResult } from "../types/math";
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

// Per-service registry for the throughput objective (latency / loss registries can be added
// here later, keyed by the same ServiceType). Registry instead of a switch: `satisfies` makes it exhaustive over ServiceType while keeping
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
