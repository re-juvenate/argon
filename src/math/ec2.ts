import type { NodeSocket } from "../types/nodes";

export interface ec2 {
  // input: throughput of the previous nodes
  input: NodeSocket;
  // output: throughput of the current node
  output: NodeSocket;
}

const INSTANCE_BANDWIDTH_MPS: Record<string, number> = {
  "t3.micro": 5000,
  "t3.small": 5000,
  "t3.medium": 5000,
  "t3.large": 5000,
  "t3.xlarge": 5000,
  "t3.2xlarge": 5000,
  "m5.large": 10000,
  "m5.xlarge": 10000,
  "m5.2xlarge": 10000,
  "m5.4xlarge": 10000,
  "c5.large": 10000,
  "c5.xlarge": 10000,
  "c5.2xlarge": 10000,
  "r5.large": 10000,
  "r5.xlarge": 10000,
};

const DEFAULT_INSTANCE = "t3.large";

export function throughputLimit(
  instanceType: string = DEFAULT_INSTANCE,
  connections: number = 0,
): number {
  return INSTANCE_BANDWIDTH_MPS[instanceType] ?? 10000;
}
