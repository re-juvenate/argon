import { ModelTier, type LatencyModel } from "../../types/math";
import { ms, note, pipe, start, tail } from "../utilities";
import { KINESIS_DEFAULTS, type KinesisConfig } from "./throughput";

// PutRecord round-trip measured range.
export const model: LatencyModel<KinesisConfig> = {
  defaults: KINESIS_DEFAULTS,

  evaluate() {
    return () =>
      pipe(
        start(ms(25), ModelTier.Measured),
        tail(ms(50)),
        note("PutRecord round-trip; data readable ~1 s after ingest (sequence scope)"),
      );
  },
};
