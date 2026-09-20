import type { CSSProperties } from "react"
import { useState } from "react"
import { createPortal } from "react-dom"
import Frame from "../../Frame"
import { serviceIcon } from "../../icons"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import Button from "../../nodeoptions/button"
import Slider from "../../nodeoptions/slider"
import { REGION_DEFAULTS, type RegionConfig } from "#math/region/throughput"
import AwsMap from "../../../modals/Map"

export const REGION_SIZE = 420

const Region = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<RegionConfig>(ServiceType.Region, REGION_DEFAULTS, id)
  const [mapOpen, setMapOpen] = useState(false)

  return (
    <>
      <Frame
        id={nodeId}
        name={`Region · ${config.code}`}
        icon={serviceIcon("region.svg")}
        style={{ minWidth: REGION_SIZE, minHeight: 240, ...style }}
        visibleChildren={
          <>
            <Button label={`Region: ${config.code}`} onClick={() => setMapOpen(true)} />
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
      {mapOpen &&
        createPortal(
          <AwsMap
            onSelect={(code) => {
              patch({ code })
              setMapOpen(false)
            }}
            onClose={() => setMapOpen(false)}
          />,
          document.body
        )}
    </>
  )
}

export default Region
