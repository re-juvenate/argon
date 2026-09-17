import { ModelTier, type ServiceModel } from "../../types/math";
import { cap, mbps, note, offered, pipe, resolve, splitEven } from "../utilities";
import { EC2_DEFAULTS, model as ec2, type EC2Config } from "../ec2/throughput";

// Auto Scaling Group: launch template instance type × instances currently in service.
// Spec: .references/reduced-formulas-throughput.md §3.3

export interface ASGConfig extends EC2Config {
  inServiceCount?: number;
}

export const ASG_DEFAULTS: Required<ASGConfig> = { instanceType: EC2_DEFAULTS.instanceType, inServiceCount: 1 };

export const model: ServiceModel<ASGConfig> = {
  defaults: ASG_DEFAULTS,

  capacity(config) {
    const c = resolve(ASG_DEFAULTS, config);
    return mbps(c.inServiceCount * ec2.capacity({ instanceType: c.instanceType }).value);
  },

  evaluate(config) {
    const capacity = model.capacity(config);
    return (ctx) =>
      pipe(offered(ctx, ModelTier.Estimated), cap(capacity), splitEven(ctx.outputCount), note("capacity = inServiceCount × EC2 burst capacity"));
  },
};
