import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import Slider from "../../nodeoptions/slider";
import Boolean from "../../nodeoptions/boolean";
import { ROUTE53_DEFAULTS, type Route53Config } from "#math/route53/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";

// Route53Config holds one weight/healthy flag PER OUTPUT SOCKET. Sockets are a
// board-level concern, so this node keeps a uniform value that the socket
// layer will fan out to every output record at wiring time.
const Route53 = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [, patch, nodeId] = useNodeConfig<Route53Config>(ServiceType.Route53, ROUTE53_DEFAULTS, id);

  const applyWeight = (w: number) => patch({ weights: [w] });
  const applyHealthy = (h: boolean) => patch({ healthy: [h] });

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.Route53]}
      icon={serviceIcon("route53.svg")}
      name="Route 53"
      style={style}
      graph={[
        { date: "Jan 22", Semi: 2890 },
        { date: "Feb 22", Semi: 2756 },
        { date: "Mar 22", Semi: 3322 },
        { date: "Apr 22", Semi: 3470 },
        { date: "May 22", Semi: 3475 },
        { date: "Jun 22", Semi: 3129 },
      ]}
      cost={50}
    >
      <Slider
        label="Record Weight"
        min={0}
        max={255}
        step={1}
        decimals={0}
        defaultValue={1}
        onChange={applyWeight}
      />
      <Boolean label="Record Healthy" defaultChecked={true} onChange={applyHealthy} />
    </Node>
  )
}

export default Route53
