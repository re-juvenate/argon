import type { NodeSocket } from "../types/nodes";
import type { ec2 } from "./ec2";

export interface ecs extends ec2 {}

const FARGATE_BANDWIDTH_MPS: Record<string, number> = {
  "vCPU-0.25-Mem-0.5GB": 1000,
  "vCPU-0.5-Mem-1GB": 1000,
  "vCPU-1-Mem-2GB": 1000,
  "vCPU-2-Mem-4GB": 1000,
  "vCPU-4-Mem-8GB": 1000,
};

const DEFAULT_TASK = "vCPU-1-Mem-2GB";

export function throughputLimit(
  taskSize: string = DEFAULT_TASK,
  connections: number = 0,
): number {
  return FARGATE_BANDWIDTH_MPS[taskSize] ?? 1000;
}
