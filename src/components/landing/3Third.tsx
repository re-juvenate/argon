import React from "react"
import { HoverImg } from "./elements/HoverImg"

const Third = () => {
  return (
    <div>
      <HoverImg
        projects={[
          { title: "Simulate", label: "The Supreme Personality of Godhead", imageSrc: "/cdn/hover-img/hover-img-img01-alt.jpg?v=3" },
          { title: "Review", label: "The Divine Couple", imageSrc: "/cdn/hover-img/hover-img-img02.jpg?v=3" },
          { title: "Deploy", label: "Eternal Bond", imageSrc: "/cdn/hover-img/hover-img-img03.jpg?v=3" },
        ]}
      />
    </div>
  )
}

export default Third
