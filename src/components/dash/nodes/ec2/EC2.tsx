import { useState, type CSSProperties } from "react";
import Node from "../../Node";
import Dropdown from "../../nodeoptions/dropdown";
import type { Option } from "../../nodeoptions/dropdown";
import { EC2_DEFAULTS, type EC2Config } from "#math/ec2/throughput";
import { EC2InstanceType } from "./instancetype";
import { EC2PlanType } from "./plantype";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";
import { ServiceType } from "../../../../types/math";

// Controls map onto the EC2Config inputs of math/ec2/throughput: instanceType
// and plan. Options come from the node's enums; their values are the AWS
// identifiers the model resolves.
const EC2 = ({ style }: { style?: CSSProperties }) => {
  const [, setConfig] = useState<EC2Config>(EC2_DEFAULTS);

  // Default instance type first so the Dropdown's initial display matches EC2_DEFAULTS.
  const instanceTypes = [
    EC2InstanceType.T3_LARGE,
    ...Object.values(EC2InstanceType).filter((t) => t !== EC2InstanceType.T3_LARGE),
  ];
  const instanceOptions: Option[] = instanceTypes.map((name) => ({
    name,
    onSelect: () => setConfig((c) => ({ ...c, instanceType: name })),
  }));

  const planOptions: Option[] = [
    EC2PlanType.ON_DEMAND,
    ...Object.values(EC2PlanType).filter((p) => p !== EC2PlanType.ON_DEMAND),
  ].map((name) => ({
    name,
    onSelect: () => setConfig((c) => ({ ...c, plan: name })),
  }));

  return (
    <Node name="EC2" color={SERVICE_COLORS[ServiceType.EC2]} icon={serviceIcon("ec2.svg")} style={style}>
      <Dropdown label="Instance Type" options={instanceOptions} />
      <Dropdown label="Purchasing Plan" options={planOptions} />
    </Node>
  );
};

export default EC2;
