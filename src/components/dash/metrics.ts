import type { NodeResult } from "#graph"

export enum Metric {
  Served = "served",
  Offered = "offered",
  P50 = "p50",
  P99 = "p99",
  Drop = "drop",
}

export interface MetricSpec {
  label: string
  unit: string
  pick: (r: NodeResult) => number
}

export const METRICS: Record<Metric, MetricSpec> = {
  [Metric.Served]: { label: "Served", unit: "Mbps", pick: (r) => r.throughput.servedMbps.value },
  [Metric.Offered]: { label: "Offered", unit: "Mbps", pick: (r) => r.throughput.offeredMbps.value },
  [Metric.P50]: { label: "p50", unit: "ms", pick: (r) => r.latency.p50Ms.value },
  [Metric.P99]: { label: "p99", unit: "ms", pick: (r) => r.latency.p99Ms.value },
  [Metric.Drop]: { label: "Drop", unit: "%", pick: (r) => r.drop.dropRate.value * 100 },
}

export interface GraphPayload {
  nodeId: string
  metric: Metric
  name: string
  color: string
}

export const GRAPH_MIME = "text/graph"

export const fmt = (v: number, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : "∞")
