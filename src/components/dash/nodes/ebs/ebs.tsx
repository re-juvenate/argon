import type { CSSProperties } from "react"
import Node from "../../Node"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import { SERVICE_COLORS } from "../../colors"
import { serviceIcon } from "../../icons"
import Dropdown from "../../nodeoptions/dropdown"
import Slider from "../../nodeoptions/slider"

interface EBSConfig {
  volumeType: string
  sizeGb: number
  iops: number
}

const EBS_DEFAULTS: EBSConfig = {
  volumeType: "gp3",
  sizeGb: 100,
  iops: 3000,
}

const EBS = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<EBSConfig>(ServiceType.EBS, EBS_DEFAULTS, id)

  const typeOptions = ["gp3", "gp2", "io1", "io2", "st1", "sc1"].map((name) => ({
    name,
    onSelect: () => patch({ volumeType: name }),
  }))

  const c = { ...EBS_DEFAULTS, ...config }

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
        label="Size (GB)"
        min={1}
        max={16000}
        defaultValue={EBS_DEFAULTS.sizeGb}
        value={c.sizeGb}
        onChange={(v) => patch({ sizeGb: v })}
      />
      {["gp3", "io1", "io2"].includes(c.volumeType) && (
        <Slider
          label="Provisioned IOPS"
          min={3000}
          max={64000}
          defaultValue={EBS_DEFAULTS.iops}
          value={c.iops}
          onChange={(v) => patch({ iops: v })}
        />
      )}
    </Node>
  )
}

export default EBS
