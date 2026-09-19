import type { CSSProperties } from "react";
import Node from "../../Node";
import { SERVICE_COLORS } from "../../colors";
import { serviceIcon } from "../../icons";
import { ServiceType } from "../../../../types/math";

const Cloudfront = ({ style }: { style?: CSSProperties }) => {
  return (
    <Node
      color={SERVICE_COLORS[ServiceType.CloudFront]}
      name="Cloudfront"
      icon={serviceIcon("cloudfront.svg")}
      style={style}
    />
  );
};

export default Cloudfront;
