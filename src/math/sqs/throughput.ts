import { ModelTier, type ServiceModel } from "../../types/math";
import { bytes, cap, isFinite, KiB, mbps, note, offered, pipe, resolve, splitEven, toMbps } from "../utilities";

// SQS. At setup you choose standard vs FIFO, and for FIFO whether high-throughput mode is on
// (its quota depends on the region). Message size is an assumption.
// Spec: .references/reduced-formulas-throughput.md §3.5

export enum QueueType {
  Standard = "standard",
  FIFO = "fifo",
}

export interface SQSConfig {
  queueType?: QueueType;
  highThroughput?: boolean;
  region?: string;
}

export const SQS_DEFAULTS: Required<SQSConfig> = { queueType: QueueType.Standard, highThroughput: false, region: "us-east-1" };

export const SQS_FIXED = {
  fifoTps: 300,
  batchSize: 10,
  maxMessageBytes: bytes(1024 * KiB),
  fifoHighThroughputTps: {
    "us-east-1": 70000,
    "us-west-2": 70000,
    "eu-west-1": 70000,
    "us-east-2": 19000,
    "eu-central-1": 19000,
    "ap-south-1": 9000,
    "ap-southeast-1": 9000,
    "ap-southeast-2": 9000,
    "ap-northeast-1": 9000,
    "eu-south-2": 9000,
    "eu-west-2": 4500,
    "sa-east-1": 4500,
  } as Record<string, number>,
  fifoHighThroughputTpsDefault: 2400,
} as const;

export const SQS_ASSUMED = {
  msgBytes: bytes(256 * KiB),
  // producers/consumers use batch API calls
  batched: true,
} as const;

export function messagesPerSecond(config?: SQSConfig): number {
  const c = resolve(SQS_DEFAULTS, config);
  if (c.queueType === QueueType.Standard) return Infinity;
  const tps = c.highThroughput
    ? (SQS_FIXED.fifoHighThroughputTps[c.region] ?? SQS_FIXED.fifoHighThroughputTpsDefault)
    : SQS_FIXED.fifoTps;
  return tps * (SQS_ASSUMED.batched ? SQS_FIXED.batchSize : 1);
}

export const model: ServiceModel<SQSConfig> = {
  defaults: SQS_DEFAULTS,

  capacity(config) {
    const mps = messagesPerSecond(config);
    return Number.isFinite(mps)
      ? toMbps(mps, bytes(Math.min(SQS_ASSUMED.msgBytes.value, SQS_FIXED.maxMessageBytes.value)))
      : mbps(Infinity);
  },

  evaluate(config) {
    const capacity = model.capacity(config);
    return (ctx) =>
      pipe(
        offered(ctx, ModelTier.Measured),
        cap(capacity),
        splitEven(ctx.outputCount),
        note(!isFinite(capacity) && "standard queue: throughput nearly unlimited"),
      );
  },
};
