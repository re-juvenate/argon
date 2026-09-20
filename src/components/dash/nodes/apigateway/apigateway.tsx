import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import { APIGATEWAY_DEFAULTS, type ApiGatewayConfig } from "#math/apigateway/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

const ApiGateway = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<ApiGatewayConfig>(ServiceType.APIGateway, APIGATEWAY_DEFAULTS, id);

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.APIGateway]}
      name="API Gateway"
      icon={serviceIcon("apigateway.svg")}
      style={style}
    >
      <Slider
        label="Rate Limit (rps)"
        min={10}
        max={50000}
        step={10}
        decimals={0}
        defaultValue={APIGATEWAY_DEFAULTS.rateLimitRps}
        value={config.rateLimitRps}
        onChange={(rateLimitRps) => patch({ rateLimitRps })}
      />
      <Slider
        label="Burst (rps)"
        min={100}
        max={50000}
        step={100}
        decimals={0}
        defaultValue={APIGATEWAY_DEFAULTS.burstRps}
        value={config.burstRps}
        onChange={(burstRps) => patch({ burstRps })}
      />
    </Node>
  );
};

export default ApiGateway;
