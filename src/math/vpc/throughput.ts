import { ModelTier, type ServiceModel } from "../../types/math";
import { mbps, note, offered, pipe, splitEven } from "../utilities";

export interface VPCConfig {
  cidr?: string;
}

export const VPC_DEFAULTS: Required<VPCConfig> = { cidr: "10.0.0.0/16" };

export const model: ServiceModel<VPCConfig> = {
  defaults: VPC_DEFAULTS,

  capacity() {
    return mbps(Infinity);
  },

  evaluate() {
    return (ctx) =>
      pipe(
        offered(ctx, ModelTier.Assumed),
        splitEven(ctx.outputCount),
        note("addressing boundary only: no data-plane cap (NAT Gateway 45 Gbps / Resolver 10k QPS not exposed)"),
      );
  },
};
