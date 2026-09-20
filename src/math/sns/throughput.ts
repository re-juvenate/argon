import { ModelTier, type Bytes, type Mbps, type ServiceModel } from "../../types/math";
import { bytes, cap, KiB, mbps, note, offered, pipe, resolve, sizeOf, toMbps } from "../utilities";

export interface SNSConfig {
  fifo?: boolean;
  region?: string;
}

export const SNS_DEFAULTS: Required<SNSConfig> = {
  fifo: false,
  region: "us-east-1",
};

const TIER_9000 = ["us-west-2", "eu-west-1"];
const TIER_1500 = ["us-east-2", "us-west-1", "ap-south-1", "ap-northeast-2", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "eu-central-1"];

export const SNS_FIXED = {
  standardRps: (region: string): number =>
    region === "us-east-1" ? 30_000 : TIER_9000.includes(region) ? 9_000 : TIER_1500.includes(region) ? 1_500 : 300,
  fifoAccountRps: (region: string): number => (region === "us-east-1" ? 30_000 : TIER_9000.includes(region) ? 9_000 : 3_000),
  fifoTopicRps: 3_000,
  fifoTopicBytesS: 20_000_000,
  fifoGroupRps: 300,
  maxMessageBytes: bytes(256 * KiB),
} as const;

export const SNS_ASSUMED = { msgBytes: bytes(8 * KiB) } as const;

export function publishRps(c: Required<SNSConfig>): number {
  return c.fifo ? Math.min(SNS_FIXED.fifoAccountRps(c.region), SNS_FIXED.fifoTopicRps) : SNS_FIXED.standardRps(c.region);
}

export function capacityFor(c: Required<SNSConfig>, size: Bytes): Mbps {
  const clamped = bytes(Math.min(size.value, SNS_FIXED.maxMessageBytes.value));
  const byRate = toMbps(publishRps(c), clamped).value;
  return mbps(c.fifo ? Math.min(byRate, (SNS_FIXED.fifoTopicBytesS * 8) / 1e6) : byRate);
}

export const model: ServiceModel<SNSConfig> = {
  defaults: SNS_DEFAULTS,

  capacity(config) {
    return capacityFor(resolve(SNS_DEFAULTS, config), SNS_ASSUMED.msgBytes);
  },

  evaluate(config) {
    const c = resolve(SNS_DEFAULTS, config);
    return (ctx) => {
      const size = sizeOf(ctx, SNS_ASSUMED.msgBytes);
      return pipe(
        offered(ctx, ModelTier.Measured),
        cap(capacityFor(c, size)),
        (r) => ({ ...r, outputsMbps: Array.from({ length: ctx.outputCount }, () => r.servedMbps) }),
        note(`${c.fifo ? "FIFO" : "standard"} topic in ${c.region}: ${publishRps(c).toLocaleString()} msg/s publish quota`),
        note(ctx.outputCount > 1 && `fan-out: each of ${ctx.outputCount} subscribers receives the full stream`),
        note(size.value > SNS_FIXED.maxMessageBytes.value && "message over 256 KiB: needs the Extended Client (S3 payload)"),
      );
    };
  },
};
