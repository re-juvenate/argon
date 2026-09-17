import Node from "./components/dash/Node";
import Dropdown from "./components/dash/nodeoptions/dropdown";
import Slider from "./components/dash/nodeoptions/slider";

const App = () => {
  return (
    <div className="bg-background h-screen w-screen">
      <Node name="EC2" color="#e66d00" />
      <Slider label="Anisotropic Rotation" min={0} max={100} defaultValue={1.0} step={1} />
      <Dropdown />
    </div>
  );
};

export default App;
