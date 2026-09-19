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
    <Card className={classNames("bg-[#0a0a0a] border-[#1f1f1f] text-white", fill ? "w-full h-full" : "w-full")}>
      <div ref={containerRef} className={classNames("w-full h-full flex", isLowHeight ? "flex-row items-center gap-6" : "flex-col")}>
        <div className={classNames(isLowHeight ? "shrink-0 w-1/3 min-w-[150px]" : "")}>
          <p className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
            {title} {!payload && <span className="text-[10px] text-amber-500 normal-case ml-1">(Peak Period)</span>}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">
            {displayValue}
            {unit && <span className="ml-1 text-base font-medium text-neutral-400">{unit}</span>}
          </p>
          <p className="mt-1 flex items-baseline justify-between">
            <span className="text-sm text-neutral-400">Tick {displayDate}</span>
            <span
              className={classNames(
                "rounded px-2 py-0.5 text-xs font-semibold",
                !payload ? "text-neutral-400 bg-neutral-900" : percentageChange > 0 ? "text-emerald-400 bg-emerald-950/40" : "text-red-400 bg-red-950/40",
              )}
            >
              {payload ? formatChange(payload, percentageChange, absoluteChange) : `Max ${title}`}
            </span>
          </p>
        </div>

        <AreaChart
          className={classNames(
            "text-white flex-1 min-w-0",
            fill ? "h-full min-h-0" : "h-80",
            isLowHeight ? "mt-0 pl-4" : "mt-6",
            "[&_.recharts-area-curve]:stroke-(--graph-color)!",
            "[&_linearGradient]:text-(--graph-color)!",
            "[&_.recharts-dot]:stroke-(--graph-color)! [&_.recharts-dot]:fill-(--graph-color)!",
          )}
          style={{ "--graph-color": color } as CSSProperties}
          data={chartdata}
          index="time"
          showLegend={false}
          autoMinValue={true}
          showYAxis={false}
          showGradient={true}
          startEndOnly={true}
          categories={["Throughput"]}
          colors={["blue"]}
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
