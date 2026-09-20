import type { CSSProperties } from "react"
import Node from "../../Node"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import { SERVICE_COLORS } from "../../colors"
import { serviceIcon } from "../../icons"
import Dropdown from "../../nodeoptions/dropdown"

interface EFSConfig {
  performanceMode: string
  throughputMode: string
}

const EFS_DEFAULTS: EFSConfig = {
  performanceMode: "General Purpose",
  throughputMode: "Elastic",
}

const EFS = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<EFSConfig>(ServiceType.EFS, EFS_DEFAULTS, id)

  const perfOptions = ["General Purpose", "Max I/O"].map((name) => ({
    name,
    onSelect: () => patch({ performanceMode: name }),
  }))

  const thruOptions = ["Bursting", "Provisioned", "Elastic"].map((name) => ({
    name,
    onSelect: () => patch({ throughputMode: name }),
  }))

  const c = { ...EFS_DEFAULTS, ...config }

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.EFS]}
      name="EFS"
      icon={serviceIcon("efs.svg")}
      style={style}
    >
      <Dropdown label="Performance Mode" options={perfOptions} value={c.performanceMode} />
      <Dropdown label="Throughput Mode" options={thruOptions} value={c.throughputMode} />
    </Node>
  )
}

export default EFS
