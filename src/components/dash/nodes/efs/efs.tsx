import type { CSSProperties } from "react"
import Node from "../../Node"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import { S3_DEFAULTS, type S3Config } from "#math/s3/throughput"
import { SERVICE_COLORS } from "../../colors"
import { serviceIcon } from "../../icons"

const EFS = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<S3Config>(ServiceType.EFS, S3_DEFAULTS, id)

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.EFS]}
      name="EFS"
      icon={serviceIcon("efs.svg")}
      style={style}
    >
      <div className="text-xs text-[#a3a3a3] font-sans px-2">File Storage</div>
    </Node>
  )
}

export default EFS
