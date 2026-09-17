import Node from "./components/dash/Node";
import EC2 from "./components/dash/nodes/ec2/EC2";
import SQS from "./components/dash/nodes/sqs/SQS";
import ELB from "./components/dash/nodes/elb/ELB";

const App = () => {
  return (
    <div className="bg-background h-screen w-screen">
      <EC2 />
      <SQS />
      <ELB />
    </div>
  );
};

export default App;
