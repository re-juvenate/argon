import { ModelTier, type ServiceModel } from "../../types/math";
import { mbps, offered, pipe, splitEven } from "../utilities";

export interface RegionConfig {
  code?: string;
}

export const REGION_CODES = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-south-1",
  "sa-east-1",
] as const;

export const REGION_DEFAULTS: Required<RegionConfig> = { code: REGION_CODES[0] };

export const model: ServiceModel<RegionConfig> = {
  defaults: REGION_DEFAULTS,

  capacity() {
    return mbps(Infinity);
  },

  evaluate() {
    return (ctx) => pipe(offered(ctx, ModelTier.Assumed), splitEven(ctx.outputCount));
  },
};
