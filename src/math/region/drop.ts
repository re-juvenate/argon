import { ModelTier, type DropModel } from "../../types/math";
import { mbps, startDrop } from "../utilities";
import { REGION_DEFAULTS, type RegionConfig } from "./throughput";

export const model: DropModel<RegionConfig> = {
  defaults: REGION_DEFAULTS,

  evaluate() {
    return (ctx) => startDrop(ctx, mbps(Infinity), ModelTier.Assumed);
  },
};
