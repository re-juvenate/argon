import type { CSSProperties } from "react"
import Frame from "../../Frame"
import { serviceIcon } from "../../icons"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import Dropdown, { type Option } from "../../nodeoptions/dropdown"
import { REGION_CODES, REGION_DEFAULTS, type RegionConfig } from "#math/region/throughput"

export const REGION_SIZE = 420

const Region = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<RegionConfig>(ServiceType.Region, REGION_DEFAULTS, id)

  const codeOptions: Option[] = [
    REGION_DEFAULTS.code,
    ...REGION_CODES.filter((code) => code !== REGION_DEFAULTS.code),
  ].map((code) => ({ name: code, onSelect: () => patch({ code }) }))

  return (
    <Frame
      id={nodeId}
      name={`Region · ${config.code}`}
      icon={serviceIcon("region.svg")}
      style={{ minWidth: REGION_SIZE, minHeight: 240, ...style }}
      visibleChildren={<Dropdown label="Region" options={codeOptions} value={config.code} />}
    />
  )
}

export default Region
