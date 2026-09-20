import { useState, useMemo, useRef, useEffect, type CSSProperties } from "react"
import { AreaChart, Card } from "@tremor/react"

export interface ChartDataItem {
  time: string
  Throughput: number
  Time: number
}

interface GraphProps {
  chartdata: ChartDataItem[]
  fill?: boolean
  color?: string
  title?: string
  unit?: string
}

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

const numberFormatter = (num: number) => {
  return Intl.NumberFormat("us").format(num).toString()
}

function formatChange(payload: any, percentageChange: number, absoluteChange: number) {
  if (!payload || isNaN(percentageChange) || !isFinite(percentageChange)) {
    return "--"
  }

  const formattedPercentage = `${percentageChange > 0 ? "+" : ""}${percentageChange.toFixed(1)}%`
  const formattedAbsolute = `${absoluteChange >= 0 ? "+" : "-"}${numberFormatter(Math.abs(absoluteChange))}`

  return `${formattedPercentage} (${formattedAbsolute})`
}

export default function Graph({ chartdata = [], fill = false, color = "#693cc5", title = "Throughput", unit = "" }: GraphProps) {
  const [hoverData, setHoverData] = useState<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLowHeight, setIsLowHeight] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsLowHeight(entry.contentRect.height < 220)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const maxItem = useMemo(() => {
    if (!chartdata || chartdata.length === 0) return null
    return chartdata.reduce((max, item) => (item.Throughput > max.Throughput ? item : max), chartdata[0])
  }, [chartdata])

  const payload = hoverData?.payload?.[0]
  const currentItem = payload ? payload.payload : maxItem

  const value = currentItem ? currentItem.Throughput : undefined

  const previousIndex = useMemo(() => {
    if (!currentItem) return -1
    return chartdata.findIndex((e) => e.time === currentItem.time)
  }, [chartdata, currentItem])

  const prevValue = useMemo(() => {
    if (previousIndex > 0) {
      return chartdata[previousIndex - 1].Throughput
    }
    return undefined
  }, [chartdata, previousIndex])

  const percentageChange = useMemo(() => {
    if (value === undefined || prevValue === undefined || prevValue === 0) return 0
    return ((value - prevValue) / prevValue) * 100
  }, [value, prevValue])

  const absoluteChange = useMemo(() => {
    if (value === undefined || prevValue === undefined) return 0
    return value - prevValue
  }, [value, prevValue])

  const displayValue = value !== undefined ? numberFormatter(value) : "--"
  const displayDate = currentItem ? currentItem.time : "--"

  return (
    <Card className={classNames("bg-[#0d0d0d] border-[#1a1a1a] text-white p-4", fill ? "w-full h-full" : "w-full")}>
      <div ref={containerRef} className={classNames("w-full h-full flex", isLowHeight ? "flex-row items-center gap-6" : "flex-col")}>
        <div className={classNames(isLowHeight ? "shrink-0 w-1/3 min-w-[150px]" : "")}>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold">
            {title} {!payload && <span className="text-amber-400 normal-case ml-1">(Peak)</span>}
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-400">
            {displayValue}
            {unit && <span className="ml-1 text-sm font-medium text-neutral-500">{unit}</span>}
          </p>
          <p className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-xs text-neutral-600">Tick {displayDate}</span>
            <span
              className={classNames(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                !payload
                  ? "text-neutral-500 bg-neutral-900"
                  : percentageChange > 0
                    ? "text-emerald-400 bg-emerald-950/60"
                    : "text-red-400 bg-red-950/50",
              )}
            >
              {payload ? formatChange(payload, percentageChange, absoluteChange) : `Max`}
            </span>
          </p>
        </div>

        <AreaChart
          className={classNames(
            "text-white flex-1 min-w-0 [&_.recharts-cartesian-axis-tick-value]:fill-neutral-600",
            fill ? "h-full min-h-0" : "h-80",
            isLowHeight ? "mt-0 pl-4" : "mt-4",
          )}
          data={chartdata}
          index="time"
          showLegend={false}
          autoMinValue={true}
          showYAxis={false}
          showGradient={true}
          startEndOnly={true}
          categories={["Throughput"]}
          colors={["emerald"]}
          customTooltip={(props) => {
            if (props.active) {
              setHoverData((prev: any) => {
                if (prev?.label === props?.label) return prev
                return props
              })
            } else {
              setHoverData(null)
            }
            return null
          }}
        />
      </div>
    </Card>
  )
}
