import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import { CLOUDFRONT_DEFAULTS, type CloudFrontConfig } from "#math/cloudfront/throughput";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";
import Boolean from "../../nodeoptions/boolean";

const Cloudfront = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<CloudFrontConfig>(ServiceType.CloudFront, CLOUDFRONT_DEFAULTS, id);

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.CloudFront]}
      name="Cloudfront"
      icon={serviceIcon("cloudfront.svg")}
      style={style}
    >
      <Boolean
        label="Origin Shield"
        defaultChecked={CLOUDFRONT_DEFAULTS.originShield}
        checked={config.originShield}
        onChange={(originShield) => patch({ originShield })}
      />
    </Node>
  );
};

export default Cloudfront;
