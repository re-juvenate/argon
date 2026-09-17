import { type FC } from "react";
import Node from "../../Node";
import EnumDropdown from "../../nodeoptions/enumdropdown";
import Slider from "../../nodeoptions/slider";
import Boolean from "../../nodeoptions/boolean";

interface EC2Props {
  innerRef?: (el: HTMLElement | null) => void;
}

const EC2: FC<EC2Props> = ({ innerRef }) => {
  return (
    <Node name="EC2" color="#e66d00" ref={innerRef}>
      <EnumDropdown
        label="Subsurface Method"
        optionNames={["Christensen-Burley", "Random Walk", "Random Walk (Skin)"]}
      >
        <>
          <Slider label="Subsurface Scale" min={0} max={2} defaultValue={1.0} />
          <Boolean label="Use Subsurface Fac" defaultChecked={false} />
        </>
        <>
          <Slider label="Subsurface Scale" min={0} max={2} defaultValue={1.0} />
          <Slider label="Anisotropic Rotation" min={0} max={1} defaultValue={0.45} />
        </>
        <>
          <Slider label="Subsurface Scale" min={0} max={5} defaultValue={2.5} />
          <Slider label="Skin Hemoglobin" min={0} max={1} defaultValue={0.8} />
          <Boolean label="Restrict Radius Bounds" defaultChecked={true} />
        </>
      </EnumDropdown>
    </Node>
  );
};

export default EC2;
