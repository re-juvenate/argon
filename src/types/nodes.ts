export enum SocketDataType {
  Float = "Float",
}

export enum SocketType {
  Input = "Input",
  Output = "Output",
}

export type PropertyValue = { type: SocketDataType.Float; value: number };

export interface NodeSocket {
  id: string;
  name: string;
  type: SocketType;
  dataType: SocketDataType;

  // circular reference back to parent. Optional to prevent issues during basic serialization.
  ownerNode?: Node;
  defaultValue: PropertyValue; // Fallback used if an Input socket has no incoming Link
}

// Blueprint blueprint template for what a node type does (Flyweight pattern)
export interface NodeDefinition {
  typeId: string; // e.g., "NODE_MATH_MULTIPLY"
  uiName: string; // e.g., "Multiply"

  inputTemplates: Omit<NodeSocket, "ownerNode">[];
  outputTemplates: Omit<NodeSocket, "ownerNode">[];

  // Core logic execution strategy
  execute: (self: Node) => void;
}

// The instantiated Node object living within a graph
export interface Node {
  instanceId: string;
  definition: NodeDefinition; // Reference to its structural behavior template

  inputs: NodeSocket[];
  outputs: NodeSocket[];

  // Internal user-exposed settings independent of socket connections (e.g., dropdown selection formulas)
  staticProperties: Map<string, PropertyValue>;

  // Layout and editor UI state
  posX: number;
  posY: number;
  isMuted: boolean;

  // Group pointer: populated *only* if this node represents a nested custom sub-graph
  subGraph?: NodeTree;
}

export interface NodeLink {
  linkId: string;

  fromSocket: NodeSocket; // Must be SocketType.Output
  toSocket: NodeSocket; // Must be SocketType.Input
}

export interface NodeTree {
  treeId: string;
  name: string; // e.g., "Procedural_Brick_Texture"

  nodes: Node[];
  links: NodeLink[];

  // Exposed structural interface configuration for when this tree is imported as a Node Group elsewhere
  interfaceInputs: Omit<NodeSocket, "ownerNode">[];
  interfaceOutputs: Omit<NodeSocket, "ownerNode">[];

  // Direct references to the mandatory entry/exit helper nodes pinned inside this nested sub-graph
  internalGroupInputNode?: Node; // funnels external parent inputs inside
  internalGroupOutputNode?: Node; // funnels internal evaluation data back up
}
