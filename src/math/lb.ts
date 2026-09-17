import type { NodeSocket } from "../types/nodes";

export interface loadbalancer {
  // input: any number of input sockets
  input: NodeSocket[];
  // output: any number of output sockets
  output: NodeSocket[];
}

const ALB_LCU_MPS = 25;
const ALB_LCU_CPS = 3000;
const DEFAULT_LCU = 2750;

export function throughputLimit(
  lcu: number = DEFAULT_LCU,
  connections: number,
): number {
  const connectionLcu = connections / ALB_LCU_CPS;
  if (connectionLcu >= lcu) return 0;
  const remainingLcu = lcu - connectionLcu;
  return remainingLcu * ALB_LCU_MPS;
}

export function lcuFromThroughput(mbps: number, cps: number): number {
  const throughputLcu = mbps / ALB_LCU_MPS;
  const connectionLcu = cps / ALB_LCU_CPS;
  return Math.max(throughputLcu, connectionLcu);
}
