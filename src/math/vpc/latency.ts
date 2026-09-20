import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, start } from "../utilities";
import { VPC_DEFAULTS, type VPCConfig } from "./throughput";

export const model: LatencyModel<VPCConfig> = {
  defaults: VPC_DEFAULTS,

  evaluate() {
    return () => start(ms(0), ModelTier.Assumed);
  },
};
