import type { CSSProperties } from "react";
import Node from "../../Node";

const ELB = ({ style }: { style?: CSSProperties }) => {
  return <Node color="#693cc5" name="ELB" style={style}></Node>;
};

export default ELB;
