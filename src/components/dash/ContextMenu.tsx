import React from "react"
// phosphor icons
import { RecycleIcon, GraphIcon } from "@phosphor-icons/react/dist/ssr"
const ContextMenu = () => {
  return (
    <div className="flex flex-col *:p-2">
      <div className="flex flex-row">
        <div>
          <GraphIcon />
        </div>
        <div>Detailed Graph</div>
      </div>
      <div className="flex flex-row">
        <div></div>
        <div>Add to Graph Menu</div>
      </div>
      <div className="flex flex-row">
        <div>
          <RecycleIcon />
        </div>
        <div>Delete</div>
      </div>
    </div>
  )
}

export default ContextMenu
