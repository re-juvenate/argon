import { useState, type CSSProperties } from "react";
import Node from "../../Node";
import Slider from "../../nodeoptions/slider";
import Boolean from "../../nodeoptions/boolean";
import { ROUTE53_DEFAULTS, type Route53Config } from "#math/route53/throughput";

// Route53Config holds one weight/healthy flag PER OUTPUT SOCKET. Sockets are a
// board-level concern, so this node keeps a uniform value that the socket
// layer will fan out to every output record at wiring time.
const Route53 = ({ style }: { style?: CSSProperties }) => {
  const [, setWeight] = useState(1);
  const [, setHealthy] = useState(true);
  const [, setConfig] = useState<Route53Config>(ROUTE53_DEFAULTS);

  const applyWeight = (w: number) => {
    setWeight(w);
    setConfig((c) => ({ ...c, weights: [w] }));
  };
  const applyHealthy = (h: boolean) => {
    setHealthy(h);
    setConfig((c) => ({ ...c, healthy: [h] }));
  };

  return (
    <Node color="#8c4fff" name="Route 53" style={style}>
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
  );
};

export default Route53;
