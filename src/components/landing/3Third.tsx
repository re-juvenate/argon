import React from "react"
import { HoverImg } from "./elements/HoverImg"

const Third = () => {
  return (
    <div className="w-full bg-white dark:bg-black py-16 md:py-24 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 mb-12 md:mb-16 text-center">
        <h2 className="text-4xl md:text-5xl font-against text-black dark:text-white transition-colors duration-300">Features</h2>
        <p className="text-neutral-500 dark:text-neutral-400 mt-4 text-base md:text-lg max-w-2xl mx-auto transition-colors duration-300">Everything you need to design, simulate, and deploy robust AWS cloud architectures.</p>
      </div>
      <HoverImg
        projects={[
          {
            title: "Graph View",
            label: "Drag, drop, and connect your AWS resources on an infinite canvas.",
            imageSrc: "/cdn/hover-img/hover-img-img01-alt.jpg?v=3",
          },
          {
            title: "Configuration",
            label: "Fine-tune EC2 instances, S3 buckets, and RDS capacities dynamically.",
            imageSrc: "/cdn/hover-img/hover-img-img02.jpg?v=3",
          },
          {
            title: "Simulation Engine",
            label: "Watch packets flow and instantly detect throughput bottlenecks.",
            imageSrc: "/cdn/hover-img/hover-img-img03.jpg?v=3",
          },
          {
            title: "Cost Estimation",
            label: "Get real-time pricing breakdowns as you scale up your design.",
            imageSrc: "/cdn/hover-img/hover-img-img01-alt.jpg?v=3",
          },
          {
            title: "Export & Deploy",
            label: "Generate Terraform code directly from your graph with one click.",
            imageSrc: "/cdn/hover-img/hover-img-img02.jpg?v=3",
          },
        ]}
      />
    </div>
  )
}

export default Third
