import type { CSSProperties } from "react";
import Node from "../../Node";

const Lambda = ({ style }: { style?: CSSProperties }) => {
  return <Node color="#d86613" name="lambda" style={style} />;
};

export default Lambda;
