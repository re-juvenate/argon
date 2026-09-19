import { ModelTier, type DropModel } from "../../types/math";
import { startDropServed } from "../utilities";
import { CLIENT_DEFAULTS, sourceMbps, type ClientConfig } from "./throughput";

export const model: DropModel<ClientConfig> = {
  defaults: CLIENT_DEFAULTS,

  evaluate(config) {
    const source = sourceMbps(config);
    return () => startDropServed(source, source, ModelTier.Assumed);
  },
};
