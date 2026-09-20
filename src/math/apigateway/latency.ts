import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, pipe, start, tail } from "../utilities";
import { APIGATEWAY_DEFAULTS, type ApiGatewayConfig } from "./throughput";

// Measured gateway overhead in front of the integration (~10 ms).
export const model: LatencyModel<ApiGatewayConfig> = {
  defaults: APIGATEWAY_DEFAULTS,

  evaluate() {
    return () =>
      pipe(
        start(ms(10), ModelTier.Measured),
        tail(ms(12)),
        note("measured gateway overhead ~10 ms + integration"),
      );
  },
};
