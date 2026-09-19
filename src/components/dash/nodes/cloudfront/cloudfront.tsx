import type { CSSProperties } from "react";
import Node from "../../Node";
import { useNodeConfig } from "#graph";
import { ServiceType } from "../../../../types/math";
import { CLOUDFRONT_DEFAULTS, type CloudFrontConfig } from "#math/cloudfront/throughput";

const Cloudfront = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [, , nodeId] = useNodeConfig<CloudFrontConfig>(ServiceType.CloudFront, CLOUDFRONT_DEFAULTS, id);

  return <Node id={nodeId} color="#693cc5" name="Cloudfront" style={style} />;
};

export default Cloudfront;
