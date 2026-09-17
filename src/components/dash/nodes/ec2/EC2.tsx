import Node from "../../Node";
import EnumDropdown from "../../nodeoptions/enumdropdown";
import Slider from "../../nodeoptions/slider";
import Boolean from "../../nodeoptions/boolean";

const EC2 = () => {
  return (
    <Node name="EC2" color="#e66d00">
      <EnumDropdown
        label="Subsurface Method"
        optionNames={["Christensen-Burley", "Random Walk", "Random Walk (Skin)"]}
      >
        {/* Index 0 Layout: Christensen-Burley */}
        <>
          <Slider label="Subsurface Scale" min={0} max={2} defaultValue={1.0} />
          <Boolean label="Use Subsurface Fac" defaultChecked={false} />
        </>
        {/* Index 1 Layout: Random Walk */}
        <>
          <Slider label="Subsurface Scale" min={0} max={2} defaultValue={1.0} />
          <Slider label="Anisotropic Rotation" min={0} max={1} defaultValue={0.45} />
        </>
        {/* Index 2 Layout: Random Walk (Skin) */}
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
