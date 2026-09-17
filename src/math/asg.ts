import type { NodeSocket } from "../types/nodes";
import { throughputLimit as ec2Throughput } from "./ec2";

export interface asg {
  input: NodeSocket[];
  output: NodeSocket[];
}

export function throughputLimit(
  instanceType: string = "t3.large",
  instanceCount: number = 1,
): number {
  return ec2Throughput(instanceType) * instanceCount;
}
