import type { CSSProperties } from "react"
import { Group, Panel, Separator } from "react-resizable-panels"

import EdgeLayer from "./Edge"
import EC2 from "./nodes/ec2/EC2"
import SQS from "./nodes/sqs/SQS"
import ELB from "./nodes/elb/ELB"
import ASG from "./frames/asg/ASG"
import Aurora from "./nodes/aurora/aurora"
import Cloudfront from "./nodes/cloudfront/cloudfront"
import Fargate from "./nodes/fargate/fargate"
import Lambda from "./nodes/lambda/lambda"
import Route53 from "./nodes/route53/route53"
import S3 from "./nodes/s3/s3"

const at = (left: number, top: number): CSSProperties => ({ left, top })

const nodeFiles = import.meta.glob("./nodes/*/*.tsx")
const nodeNames = Object.keys(nodeFiles).map((path) => {
  const parts = path.split("/")
  const fileName = parts[parts.length - 1]
  return fileName.replace(".tsx", "").toUpperCase()
})

export default function Layout() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-background">
      <Group orientation="vertical" className="w-full h-full">
        <Panel defaultSize="85%" minSize="50%">
          <Group orientation="horizontal" className="w-full h-full">
            <Panel defaultSize="15%" minSize="10%" maxSize="30%" className="bg-gray-50/10">
              <section className="h-full w-full p-4 flex flex-col gap-2 overflow-y-auto">
                <div className="text-sm font-semibold mb-2 text-white">Services</div>
                {nodeNames.map((name) => (
                  <div
                    key={name}
                    className="px-3 py-2 bg-neutral-800 text-white rounded text-sm font-mono"
                  >
                    {name}
                  </div>
                ))}
              </section>
            </Panel>

            <Separator className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors duration-150 cursor-col-resize" />

            <Panel defaultSize="85%">
              <div
                data-island-board
                className="relative w-full h-full overflow-hidden bg-background"
              >
                <EdgeLayer>
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
                </EdgeLayer>
              </div>
            </Panel>
          </Group>
        </Panel>

        <Separator className="h-1 bg-gray-200 hover:bg-blue-500 transition-colors duration-150 cursor-row-resize" />

        <Panel defaultSize="15%" minSize="0%" maxSize="40%" className="bg-gray-50/5">
          <section className="h-full w-full p-4">hello</section>
        </Panel>
      </Group>
    </div>
  )
}
