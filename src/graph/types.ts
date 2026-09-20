import { z } from "zod"
import { ServiceType } from "../types/math"

export interface Position {
  x: number
  y: number
}

export interface GraphNode {
  id: string
  service: ServiceType
  name?: string
  config: Record<string, unknown>
  position?: Position
  parentId?: string
  suggested?: boolean
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  avgBytes?: number
  suggested?: boolean
  suggestedRemoval?: boolean
}

export interface NodeUpdate {
  id: string
  name?: string
  config?: Record<string, unknown>
  position?: Position
}

export interface Suggestion {
  nodes: GraphNode[]
  edges: GraphEdge[]
  removedEdges: string[]
  updates: NodeUpdate[]
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
  nodes: [
    {
      id: "default-client",
      service: ServiceType.Client,
      config: {},
      position: { x: 50000, y: 50000 },
    }
  ],
  edges: [],
})

const positionSchema = z.object({ x: z.number(), y: z.number() })

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  service: z.enum(ServiceType),
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  position: positionSchema.optional(),
  parentId: z.string().min(1).optional(),
  suggested: z.boolean().optional(),
})

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  avgBytes: z.number().positive().optional(),
  suggested: z.boolean().optional(),
  suggestedRemoval: z.boolean().optional(),
})

export const nodeUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  position: positionSchema.optional(),
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
