import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, start } from "../utilities";
import { REGION_DEFAULTS, type RegionConfig } from "./throughput";

export const model: LatencyModel<RegionConfig> = {
  defaults: REGION_DEFAULTS,

  evaluate() {
    return () => start(ms(0), ModelTier.Assumed);
  },
};
