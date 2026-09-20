import { ModelTier, type DropModel } from "../../types/math";
import { mbps, startDrop } from "../utilities";
import { VPC_DEFAULTS, type VPCConfig } from "./throughput";

export const model: DropModel<VPCConfig> = {
  defaults: VPC_DEFAULTS,

  evaluate() {
    return (ctx) => startDrop(ctx, mbps(Infinity), ModelTier.Assumed);
  },
};
