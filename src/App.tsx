import EC2 from "./components/dash/nodes/ec2/EC2";
import SQS from "./components/dash/nodes/sqs/SQS";
import ELB from "./components/dash/nodes/elb/ELB";
import ASG from "./components/dash/frames/asg/ASG";
import Layout from "./components/dash/Layout";

const App = () => {
  return (
    <div className="bg-background min-h-screen w-screen">
      {/*<EC2 />
      <SQS />
      <ELB />
      <ASG n={8}>
        <EC2 />
      </ASG>*/}
      <Layout />
    </div>
  );
};

export default App;
