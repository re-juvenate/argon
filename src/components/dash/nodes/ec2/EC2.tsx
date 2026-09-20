import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Dropdown from "../../nodeoptions/dropdown";
import type { Option } from "../../nodeoptions/dropdown";
import { EC2_DEFAULTS, INSTANCE_SPECS, type EC2Config } from "#math/ec2/throughput";
import { PLAN_SPECS } from "#math/ec2/drop";
import { EC2InstanceType } from "./instancetype";
import { EC2PlanType } from "./plantype";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

// Controls map onto the EC2Config inputs of math/ec2/throughput: instanceType
// and plan. Options come from the node's enums; their values are the AWS
// identifiers the model resolves.
const EC2 = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<EC2Config>(ServiceType.EC2, EC2_DEFAULTS, id);

  // Default instance type first so the Dropdown's initial display matches EC2_DEFAULTS.
  const instanceTypes = [
    EC2InstanceType.T3_LARGE,
    ...Object.values(EC2InstanceType).filter((t) => t !== EC2InstanceType.T3_LARGE),
  ];
  const instanceOptions: Option[] = instanceTypes.map((name) => ({
    name,
    onSelect: () => patch({ instanceType: name }),
  }));

  const planOptions: Option[] = [
    EC2PlanType.ON_DEMAND,
    ...Object.values(EC2PlanType).filter((p) => p !== EC2PlanType.ON_DEMAND),
  ].map((name) => ({
    name,
    onSelect: () => patch({ plan: name }),
  }));

  const spec = INSTANCE_SPECS[config.instanceType ?? EC2_DEFAULTS.instanceType]
  const plan = PLAN_SPECS[config.plan ?? EC2_DEFAULTS.plan]
  
  let costStr: string | undefined
  if (spec && plan) {
    const hourly = spec.ondemandHourlyCostUsd * (1 - plan.discountPct / 100)
    costStr = (hourly * 730).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "/mo"
  }

  return (
    <Node
      id={nodeId}
      name="EC2"
      color={SERVICE_COLORS[ServiceType.EC2]}
      icon={serviceIcon("ec2.svg")}
      style={style}
      cost={costStr}
    >
      <Dropdown label="Instance Type" options={instanceOptions} value={config.instanceType} />
      <Dropdown label="Purchasing Plan" options={planOptions} value={config.plan} />
    </Node>
  );
};

export default EC2;
