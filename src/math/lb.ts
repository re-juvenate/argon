import type { NodeSocket } from "../types/nodes";

export interface loadbalancer {
  // input: any number of input sockets
  input: NodeSocket[];
  // output: any number of output sockets
  output: NodeSocket[];
}
