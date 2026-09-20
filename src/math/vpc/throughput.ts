import { ModelTier, type ServiceModel } from "../../types/math";
import { mbps, note, offered, pipe } from "../utilities";

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
    return (ctx) => pipe(offered(ctx, ModelTier.Assumed), note("frame: no sockets, no data-plane cap; members inherit the Region hop"));
  },
};
