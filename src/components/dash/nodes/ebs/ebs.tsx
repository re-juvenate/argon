import type { CSSProperties } from "react"
import Node from "../../Node"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import { SERVICE_COLORS } from "../../colors"
import { serviceIcon } from "../../icons"
import Dropdown from "../../nodeoptions/dropdown"
import Slider from "../../nodeoptions/slider"
import { EBS_DEFAULTS, VolumeType, type EBSConfig } from "#math/ebs/throughput"

const EBS = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<EBSConfig>(ServiceType.EBS, EBS_DEFAULTS, id)

  const typeOptions = Object.values(VolumeType).map((name) => ({
    name,
    onSelect: () => patch({ volumeType: name }),
  }))

  const c = { ...EBS_DEFAULTS, ...config }
  const provisioned = [VolumeType.GP3, VolumeType.IO1, VolumeType.IO2].includes(c.volumeType)

  return (
    <Node
      id={nodeId}
      color={SERVICE_COLORS[ServiceType.EBS]}
      name="EBS"
      icon={serviceIcon("ebs.svg")}
      style={style}
    >
      <Dropdown label="Volume Type" options={typeOptions} value={c.volumeType} />
      <Slider
        label="Size (GiB)"
        min={1}
        max={16000}
        step={1}
        decimals={0}
        defaultValue={EBS_DEFAULTS.sizeGb}
        value={c.sizeGb}
        onChange={(sizeGb) => patch({ sizeGb })}
      />
      {provisioned && (
        <Slider
          label="Provisioned IOPS"
          min={100}
          max={c.volumeType === VolumeType.IO2 ? 256000 : c.volumeType === VolumeType.GP3 ? 80000 : 64000}
          step={100}
          decimals={0}
          defaultValue={EBS_DEFAULTS.iops}
          value={c.iops}
          onChange={(iops) => patch({ iops })}
        />
      )}
      {c.volumeType === VolumeType.GP3 && (
        <Slider
          label="Throughput (MiB/s)"
          min={125}
          max={2000}
          step={5}
          decimals={0}
          defaultValue={EBS_DEFAULTS.throughputMiBps}
          value={c.throughputMiBps}
          onChange={(throughputMiBps) => patch({ throughputMiBps })}
        />
      )}
    </Node>
  )
}

export default EBS
