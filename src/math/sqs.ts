import type { NodeSocket } from "../types/nodes";

export interface sqs {
  input: NodeSocket;
  output: NodeSocket;
}

const STANDARD_MAX_TPS = 3000;
const FIFO_MAX_TPS = 3000;

export function throughputLimit(
  queueType: "standard" | "fifo" = "standard",
  connections: number = 0,
): number {
  const tps = queueType === "fifo" ? FIFO_MAX_TPS : STANDARD_MAX_TPS;
  const MESSAGE_SIZE_KB = 256;
  return (tps * MESSAGE_SIZE_KB * 8) / 1000;
}
