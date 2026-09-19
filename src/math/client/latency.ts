import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, start } from "../utilities";
import { CLIENT_DEFAULTS, type ClientConfig } from "./throughput";

export const model: LatencyModel<ClientConfig> = {
  defaults: CLIENT_DEFAULTS,

  evaluate() {
    return () => start(ms(0), ModelTier.Assumed);
  },
};
