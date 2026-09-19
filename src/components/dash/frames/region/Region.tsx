import type { CSSProperties } from "react"
import Frame from "../../Frame"
import { serviceIcon } from "../../icons"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import Dropdown, { type Option } from "../../nodeoptions/dropdown"
import Slider from "../../nodeoptions/slider"
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
      visibleChildren={
        <>
          <Dropdown label="Region" options={codeOptions} value={config.code} />
          <Slider
            label="Availability Zones"
            min={2}
            max={6}
            step={1}
            decimals={0}
            defaultValue={REGION_DEFAULTS.azCount}
            value={config.azCount}
            onChange={(azCount) => patch({ azCount })}
          />
          <Slider
            label="Cross-AZ RTT (ms)"
            min={0.25}
            max={3.5}
            step={0.05}
            decimals={2}
            defaultValue={REGION_DEFAULTS.crossAzMs}
            value={config.crossAzMs}
            onChange={(crossAzMs) => patch({ crossAzMs })}
          />
          <Slider
            label="Lambda Concurrency Pool"
            min={10}
            max={20000}
            step={10}
            decimals={0}
            defaultValue={REGION_DEFAULTS.lambdaConcurrency}
            value={config.lambdaConcurrency}
            onChange={(lambdaConcurrency) => patch({ lambdaConcurrency })}
          />
        </>
      }
    />
  )
}

export default Region
