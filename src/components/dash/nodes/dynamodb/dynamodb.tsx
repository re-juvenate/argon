import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import Boolean from "../../nodeoptions/boolean";
import { DYNAMODB_DEFAULTS, type DynamoDBConfig } from "#math/dynamodb/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

const DynamoDB = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<DynamoDBConfig>(ServiceType.DynamoDB, DYNAMODB_DEFAULTS, id);

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.DynamoDB]}
      name="DynamoDB"
      icon={serviceIcon("dynamodb.svg")}
      style={style}
    >
      <Slider
        label="Read Capacity (RCU)"
        min={1}
        max={40000}
        step={1}
        decimals={0}
        defaultValue={DYNAMODB_DEFAULTS.readCapacityUnits}
        value={config.readCapacityUnits}
        onChange={(readCapacityUnits) => patch({ readCapacityUnits })}
      />
      <Boolean
        label="Strongly Consistent"
        defaultChecked={DYNAMODB_DEFAULTS.consistentRead}
        checked={config.consistentRead}
        onChange={(consistentRead) => patch({ consistentRead })}
      />
    </Node>
  );
};

export default DynamoDB;
