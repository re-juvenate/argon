import Node from "./components/dash/Node";
import EC2 from "./components/dash/nodes/ec2/EC2";

const App = () => {
  return (
    <div className="bg-background h-screen w-screen">
      <EC2 />
    </div>
  );
};

export default App;
