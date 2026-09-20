import { useRef } from "react"
import { DownloadSimpleIcon, UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr"
import clsx from "clsx"
import { graphStore } from "#graph"

const button = "grid size-10 place-items-center text-lg border border-border text-gray-200 transition-colors bg-neutral-800 hover:bg-neutral-700"

export default function GraphIo() {
  const input = useRef<HTMLInputElement>(null)

  const exportJson = () => {
    const blob = new Blob([graphStore.toJSON()], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "graph.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file: File | undefined) => {
    if (!file) return
    try {
      graphStore.fromJSON(await file.text())
    } catch (error) {
      window.alert(`Could not import graph: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <div
      id="tour-deploy"
      onPointerDown={(e) => e.stopPropagation()}
      className="flex flex-col items-center gap-2 p-2 min-w-14 w-max bg-neutral-950/90 border border-border shadow-lg shadow-black/40 backdrop-blur"
    >
      <button type="button" title="export JSON" onClick={exportJson} className={clsx(button)}>
        <DownloadSimpleIcon weight="bold" />
      </button>
      <button type="button" title="import JSON" onClick={() => input.current?.click()} className={clsx(button)}>
        <UploadSimpleIcon weight="bold" />
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void importJson(e.target.files?.[0])
          e.target.value = ""
        }}
      />
    </div>
  )
}
