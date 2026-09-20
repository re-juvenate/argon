import { HoverImg } from "./elements/HoverImg"

import graphImg from "../../assets/landing/graph.jpeg"
import configVid from "../../assets/landing/config.mp4"
import simulationVid from "../../assets/landing/simulation.mp4"
import costImg from "../../assets/landing/cost.png"
import deployVid from "../../assets/landing/deploy.mp4"

const Third = () => {
  return (
    <div className="w-full bg-white dark:bg-black py-4 md:py-8 transition-colors duration-300">
      <p className="max-w-full px-6 text-black dark:text-white text-xl md:text-2xl transition-colors duration-300">
        Everything you need to design, simulate, and deploy robust AWS cloud architectures.
      </p>

      <HoverImg
        projects={[
          {
            title: "Graph View",
            label: "Drag, drop, and connect your AWS resources on an infinite canvas.",
            imageSrc: graphImg,
            type: "image",
          },
          {
            title: "Configuration",
            label: "Fine-tune EC2 instances, S3 buckets, and RDS capacities dynamically.",
            imageSrc: configVid,
            type: "video",
          },
          {
            title: "Simulation Engine",
            label: "Watch packets flow and instantly detect throughput bottlenecks.",
            imageSrc: simulationVid,
            type: "video",
          },
          {
            title: "Cost Estimation",
            label: "Get real-time pricing breakdowns as you scale up your design.",
            imageSrc: costImg,
            type: "image",
          },
          {
            title: "Export & Deploy",
            label: "Generate Terraform code directly from your graph with one click.",
            imageSrc: deployVid,
            type: "video",
          },
        ]}
      />
    </div>
  )
}

export default Third
