import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import Node from "./Node";
import EC2 from "./nodes/ec2/EC2";
import SQS from "./nodes/sqs/SQS";
import ELB from "./nodes/elb/ELB";
import ASG from "./frames/asg/ASG";

gsap.registerPlugin(Draggable, InertiaPlugin);

export default function NodeContainer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const nodes = gsap.utils.toArray<HTMLElement>(".draggable-node");

      const draggableInstances = nodes.map((node) => {
        const handle = node.querySelector(".draggable-node-handle") || undefined;

        return Draggable.create(node, {
          type: "x,y",
          bounds: containerRef.current,
          inertia: true,
          trigger: handle,
        })[0];
      });

      return () => {
        draggableInstances.forEach((instance) => instance?.kill());
      };
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-background">
      <EC2 />
      <SQS />
      <ELB />
      <ASG n={8}>
        <EC2 />
      </ASG>
    </div>
  );
}
