import { z } from "zod"
import { ServiceType } from "../types/math"

export interface Position {
  x: number
  y: number
}

export interface GraphNode {
  id: string
  service: ServiceType
  config: Record<string, unknown>
  position?: Position
  parentId?: string
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  avgBytes?: number
}

export interface GlobalDefaults {
  dtSeconds: number
  avgBytes?: number
}

export interface Graph {
  version: 1
  defaults: GlobalDefaults
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const GLOBAL_DEFAULTS: GlobalDefaults = { dtSeconds: 1 }

export const emptyGraph = (defaults: Partial<GlobalDefaults> = {}): Graph => ({
  version: 1,
  defaults: { ...GLOBAL_DEFAULTS, ...defaults },
  nodes: [],
  edges: [],
})

const positionSchema = z.object({ x: z.number(), y: z.number() })

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  service: z.enum(ServiceType),
  config: z.record(z.string(), z.unknown()).default({}),
  position: positionSchema.optional(),
  parentId: z.string().min(1).optional(),
})

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  avgBytes: z.number().positive().optional(),
})

export const globalDefaultsSchema = z.object({
  dtSeconds: z.number().positive().default(GLOBAL_DEFAULTS.dtSeconds),
  avgBytes: z.number().positive().optional(),
})

export const graphSchema = z.object({
  version: z.literal(1),
  defaults: globalDefaultsSchema.default(GLOBAL_DEFAULTS),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
})
