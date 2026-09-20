import React from "react"
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"
import worldAtlas from "../../assets/world.json"
import cn from "cnfast"

const GEO_DATA = worldAtlas as any

interface AwsRegion {
  code: string
  name: string
  coordinates: [number, number]
}

const AWS_REGIONS: AwsRegion[] = [
  { code: "us-east-1", name: "N. Virginia", coordinates: [-77.4524, 38.994] },
  { code: "us-east-2", name: "Ohio", coordinates: [-82.7541, 40.0946] },
  { code: "us-west-1", name: "N. California", coordinates: [-122.1537, 37.4437] },
  { code: "us-west-2", name: "Oregon", coordinates: [-123.88, 46.15] },
  { code: "ca-central-1", name: "Canada Central", coordinates: [-73.6, 45.5] },
  { code: "eu-west-1", name: "Ireland", coordinates: [-8.0, 53.0] },
  { code: "eu-west-2", name: "London", coordinates: [-0.1, 51.0] },
  { code: "eu-central-1", name: "Frankfurt", coordinates: [8.0, 50.0] },
  { code: "ap-southeast-1", name: "Singapore", coordinates: [103.8, 1.37] },
  { code: "ap-southeast-2", name: "Sydney", coordinates: [151.2, -33.86] },
  { code: "ap-northeast-1", name: "Tokyo", coordinates: [139.42, 35.41] },
  { code: "ap-south-1", name: "Mumbai", coordinates: [72.88, 19.08] },
  { code: "sa-east-1", name: "São Paulo", coordinates: [-46.38, -23.34] },
]

const WorldGeographies = React.memo(() => (
  <Geographies geography={GEO_DATA}>
    {({ geographies }) => geographies.map((geo) => <Geography key={geo.rsmKey} geography={geo} fill="#0066FF" fillOpacity={Math.random()} />)}
  </Geographies>
))

WorldGeographies.displayName = "WorldGeographies"

const RegionMarker = React.memo(
  ({
    region,
    onHover,
    onLeave,
    onSelect,
  }: {
    region: AwsRegion
    onHover: (r: AwsRegion) => void
    onLeave: () => void
    onSelect?: (code: string) => void
  }) => {
    return (
      <Marker coordinates={region.coordinates}>
        <g
          className="group cursor-pointer"
          onMouseEnter={() => onHover(region)}
          onMouseLeave={onLeave}
          onClick={() => onSelect?.(region.code)}
        >
          <rect
            x={-3.5}
            y={-3.5}
            width={7}
            height={7}
            fill="white"
            stroke="black"
            strokeWidth={0.5}
            className={cn(
              "origin-center transform-fill transition-transform duration-200 ease-out group-hover:scale-150"
            )}
          />

          <text
            x={0}
            y={-8}
            textAnchor="middle"
            className="pointer-events-none select-none fill-white text-[10px] font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          >
            {region.name}
          </text>
        </g>
      </Marker>
    )
  }
)

RegionMarker.displayName = "RegionMarker"

export default function AwsMap({ onSelect, onClose }: { onSelect?: (code: string) => void; onClose?: () => void }) {
  const [hovered, setHovered] = React.useState<AwsRegion | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative h-[80vh] w-[80vw] overflow-hidden rounded-xl bg-[#0f1011] shadow-2xl border border-border" onClick={(e) => e.stopPropagation()}>
        <div
          className={cn(
            "text-white absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center transition-opacity duration-300 z-10",
            hovered ? "opacity-100" : "opacity-0"
          )}
        >
          <h2 className="text-4xl font-bold tracking-wide shadow-black drop-shadow-md">{hovered?.name || "Region"}</h2>
          <p className="mt-2 shadow-black drop-shadow-md">{hovered?.code || "aws-region"}</p>
        </div>

        <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 140 }} className="block h-full w-full">
          <WorldGeographies />

          {AWS_REGIONS.map((region) => (
            <RegionMarker
              key={region.code}
              region={region}
              onHover={setHovered}
              onLeave={() => setHovered(null)}
              onSelect={onSelect}
            />
          ))}
        </ComposableMap>
      </div>
    </div>
  )
}
