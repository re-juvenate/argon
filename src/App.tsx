import EC2 from "./components/dash/nodes/ec2/EC2";
import SQS from "./components/dash/nodes/sqs/SQS";
import ELB from "./components/dash/nodes/elb/ELB";
import ASG from "./components/dash/frames/asg/ASG";

const App = () => {
  return (
    <div className="bg-background h-screen w-screen">
      <EC2 />
      <SQS />
      <ELB />
      <ASG n={3} />
    </div>
  );
};

export default App;
