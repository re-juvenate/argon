import type { CSSProperties } from "react";

import EC2 from "./nodes/ec2/EC2";
import SQS from "./nodes/sqs/SQS";
import ELB from "./nodes/elb/ELB";
import ASG from "./frames/asg/ASG";
import Aurora from "./nodes/aurora/aurora";
import Cloudfront from "./nodes/cloudfront/cloudfront";
import Fargate from "./nodes/fargate/fargate";
import Lambda from "./nodes/lambda/lambda";
import Route53 from "./nodes/route53/route53";
import S3 from "./nodes/s3/s3";

const at = (left: number, top: number): CSSProperties => ({ left, top });

export default function NodeContainer() {
  return (
    <div
      data-island-board
      className="relative w-full h-screen overflow-hidden bg-background"
    >
      <EC2 style={at(40, 40)} />
      <SQS style={at(340, 40)} />
      <ELB style={at(640, 40)} />
      <ASG n={8} style={at(940, 360)}>
        <EC2 />
      </ASG>
      <Aurora style={at(40, 360)} />
      <Cloudfront style={at(340, 360)} />
      <ELB style={at(640, 360)} />
      <Fargate style={at(40, 620)} />
      <Lambda style={at(340, 620)} />
      <Route53 style={at(640, 620)} />
      <S3 style={at(940, 40)} />
    </div>
  );
}
