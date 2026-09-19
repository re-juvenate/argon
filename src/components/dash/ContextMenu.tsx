import React from "react"
// phosphor icons
import { RecycleIcon, GraphIcon } from "@phosphor-icons/react/dist/ssr"
const ContextMenu = () => {
  return (
    <div className="flex flex-col py-1">
      <div className="flex flex-row items-center gap-2 px-3 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors">
        <GraphIcon className="size-4" />
        <span className="text-sm">Detailed Graph</span>
      </div>
      <div className="flex flex-row items-center gap-2 px-3 py-1.5 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors">
        <div className="size-4" />
        <span className="text-sm">Add to Graph Menu</span>
      </div>
      <div className="flex flex-row items-center gap-2 px-3 py-1.5 hover:bg-red-600 hover:text-white cursor-pointer transition-colors text-red-400">
        <RecycleIcon className="size-4" />
        <span className="text-sm">Delete</span>
      </div>
    </div>
  )
}

export default ContextMenu
