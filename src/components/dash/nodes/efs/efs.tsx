import type { CSSProperties } from "react"
import Node from "../../Node"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import { SERVICE_COLORS } from "../../colors"
import { serviceIcon } from "../../icons"
import Dropdown from "../../nodeoptions/dropdown"
import Slider from "../../nodeoptions/slider"
import { EFS_DEFAULTS, PerformanceMode, ThroughputMode, type EFSConfig } from "#math/efs/throughput"

const EFS = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<EFSConfig>(ServiceType.EFS, EFS_DEFAULTS, id)

  const perfOptions = Object.values(PerformanceMode).map((name) => ({
    name,
    onSelect: () => patch({ performanceMode: name }),
  }))

  const thruOptions = Object.values(ThroughputMode).map((name) => ({
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
      {c.throughputMode === ThroughputMode.Bursting && (
        <Slider
          label="Stored (GiB)"
          min={1}
          max={16384}
          step={1}
          decimals={0}
          defaultValue={EFS_DEFAULTS.sizeGb}
          value={c.sizeGb}
          onChange={(sizeGb) => patch({ sizeGb })}
        />
      )}
      {c.throughputMode === ThroughputMode.Provisioned && (
        <Slider
          label="Provisioned (MiB/s)"
          min={1}
          max={3072}
          step={1}
          decimals={0}
          defaultValue={EFS_DEFAULTS.provisionedMiBps}
          value={c.provisionedMiBps}
          onChange={(provisionedMiBps) => patch({ provisionedMiBps })}
        />
      )}
    </Node>
  )
}

export default EFS
