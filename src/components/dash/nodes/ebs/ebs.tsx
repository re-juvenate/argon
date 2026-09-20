import type { CSSProperties } from "react"
import Node from "../../Node"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import { S3_DEFAULTS, type S3Config } from "#math/s3/throughput"
import { SERVICE_COLORS } from "../../colors"
import { serviceIcon } from "../../icons"

const EBS = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<S3Config>(ServiceType.EBS, S3_DEFAULTS, id)

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.EBS]}
      name="EBS"
      icon={serviceIcon("ebs.svg")}
      style={style}
    >
      <div className="text-xs text-[#a3a3a3] font-sans px-2">Block Storage</div>
    </Node>
  )
}

export default EBS
