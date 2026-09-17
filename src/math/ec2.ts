import type { NodeSocket } from "../types/nodes";

export interface ec2 {
  // input: throughput of the previous nodes
  input: NodeSocket;
  // output: throughput of the current node
  output: NodeSocket;
}
