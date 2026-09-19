import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"
import { createRoot } from "react-dom/client"

import gsap from "gsap"
import { Draggable } from "gsap/Draggable"
import { InertiaPlugin } from "gsap/InertiaPlugin"

import { Group, Panel, Separator } from "react-resizable-panels"
import clsx from "clsx"

import { ServiceType } from "../../types/math"
import EdgeLayer from "./Edge"
import Viewport from "./Viewport"
import { GRAPH_MIME, Metric, METRICS, type GraphPayload } from "./metrics"
import ContextMenu, { type MenuAt, type MenuItem } from "./ContextMenu"
import { ChartLineIcon, SquaresFourIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"

gsap.registerPlugin(Draggable, InertiaPlugin)

import EC2 from "./nodes/ec2/EC2"
import SQS from "./nodes/sqs/SQS"
import ELB from "./nodes/elb/ELB"
import ASG from "./frames/asg/ASG"
import Region from "./frames/region/Region"
import Client from "./nodes/client/Client"
import Aurora from "./nodes/aurora/aurora"
import Cloudfront from "./nodes/cloudfront/cloudfront"
import Fargate from "./nodes/fargate/fargate"
import Lambda from "./nodes/lambda/lambda"
import Route53 from "./nodes/route53/route53"
import S3 from "./nodes/s3/s3"

import { EditorProvider, useEditor } from "./EditorContext"
import { DEFAULT_DOCKED, DockedGraphCard, type Docked } from "./GraphPanel"
import { GRID, CARD_W } from "./GraphPanel"
import { serviceIcon } from "./icons"
import { SERVICE_COLORS } from "./colors"
import { graphStore, useGraph } from "#graph"
import { SimulationProvider } from "./Simulation"
import SimulationBar from "./SimulationBar"
import type { GraphNode } from "#graph/types"

const at = (left: number, top: number): CSSProperties => ({
  left,
  top,
})

const DELETION_KEYS = new Set(["Backspace", "Delete"])

interface NodeComponentProps {
  style?: CSSProperties
  id?: string
}

const SERVICES: Record<ServiceType, ComponentType<NodeComponentProps>> = {
  [ServiceType.EC2]: EC2,
  [ServiceType.ECS]: Fargate,
  [ServiceType.ASG]: ASG,
  [ServiceType.LB]: ELB,
  [ServiceType.SQS]: SQS,
  [ServiceType.Lambda]: Lambda,
  [ServiceType.S3]: S3,
  [ServiceType.CloudFront]: Cloudfront,
  [ServiceType.Route53]: Route53,
  [ServiceType.Aurora]: Aurora,
  [ServiceType.Client]: Client,
  [ServiceType.Region]: Region,
}

const SERVICE_ICON_FILES: Record<ServiceType, string | undefined> = {
  [ServiceType.EC2]: "ec2.svg",
  [ServiceType.ECS]: "ecs.svg",
  [ServiceType.ASG]: "asg.svg",
  [ServiceType.LB]: "elb.svg",
  [ServiceType.SQS]: "sqs.svg",
  [ServiceType.Lambda]: "lambda.svg",
  [ServiceType.S3]: "s3.svg",
  [ServiceType.CloudFront]: "cloudfront.svg",
  [ServiceType.Route53]: "route53.svg",
  [ServiceType.Aurora]: "aurora.svg",
  [ServiceType.Client]: undefined,
  [ServiceType.Region]: "region.svg",
}

const PALETTE = Object.values(ServiceType).map((service) => {
  const file = SERVICE_ICON_FILES[service]
  return { service, icon: file ? serviceIcon(file as `${string}.svg`) : undefined }
})

const isService = (value: string): value is ServiceType => (Object.values(ServiceType) as string[]).includes(value)

const sidebarItem = clsx(
  "flex items-center gap-2.5 px-3 py-2 bg-neutral-800 text-white rounded text-sm font-mono select-none",
  "cursor-grab active:cursor-grabbing hover:bg-neutral-700 transition-colors",
)

const sidebarIcon = clsx("size-5 shrink-0 pointer-events-none object-contain")

const board = (hovering: boolean) =>
  clsx(
    // No overflow clipping: the canvas is infinite, the viewport owns the clip.
    "relative w-full h-full transition-shadow duration-150 select-none outline-none",
    hovering && "shadow-[inset_0_0_0_2px_var(--color-blueprimary)]",
  )

const moveNode = (id: string, parentId: string | null, x: number, y: number) => graphStore.place(id, { x, y }, parentId)

export default function Layout() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hovering, setHovering] = useState(false)

  return (
    <SimulationProvider>
      <EditorProvider moveNode={moveNode}>
        <Editor
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          hovering={hovering}
          setHovering={setHovering}
        />
      </EditorProvider>
    </SimulationProvider>
  )
}

interface EditorProps {
  selectedId: string | null
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>
  hovering: boolean
  setHovering: React.Dispatch<React.SetStateAction<boolean>>
}

function Editor({ selectedId, setSelectedId, hovering, setHovering }: EditorProps) {
  const { frameBodies } = useEditor()
  const { nodes } = useGraph()

  const [docked, setDocked] = useState<Docked[]>(DEFAULT_DOCKED)
  const [menu, setMenu] = useState<{ at: MenuAt; node: GraphNode } | null>(null)
  const dockedCards = useRef(new Map<string, HTMLDivElement | null>())
  const moveDocked = useCallback((id: string, x: number, y: number) => {
    setDocked((items) => items.map((item) => (item.id === id ? { ...item, x, y } : item)))
  }, [])

  const dock = useCallback((payload: GraphPayload, x = GRID, y = GRID) => {
    const snap = (v: number) => Math.round(v / GRID) * GRID
    setDocked((items) => {
      const taken = new Set(items.map((i) => `${i.x},${i.y}`))
      let px = snap(x)
      while (taken.has(`${px},${snap(y)}`)) px += CARD_W
      return [...items, { id: crypto.randomUUID(), nodeId: payload.nodeId, metric: payload.metric, name: payload.name, color: payload.color, x: px, y: snap(y) }]
    })
  }, [])

  const onGraphDrop = (e: DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(GRAPH_MIME)
    if (!raw) return

    e.preventDefault()
    e.stopPropagation()

    const payload = JSON.parse(raw) as GraphPayload
    const rect = e.currentTarget.getBoundingClientRect()
    dock(payload, e.clientX - rect.left - CARD_W / 2, e.clientY - rect.top - 40)
  }

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    graphStore.removeNode(selectedId)
    setSelectedId(null)
  }, [selectedId, setSelectedId])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!DELETION_KEYS.has(e.key)) return
      const target = e.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "")) {
        return
      }
      deleteSelected()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [deleteSelected])

  const onBoardContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      const island = (e.target as HTMLElement).closest<HTMLElement>("[data-island-id]")
      const id = island?.dataset.islandId
      const node = id ? graphStore.get().nodes.find((n) => n.id === id) : undefined
      if (!node) return
      e.preventDefault()
      setSelectedId(node.id)
      setMenu({ at: { x: e.clientX, y: e.clientY }, node })
    },
    [setSelectedId],
  )

  const menuItems = (node: GraphNode): MenuItem[] => {
    const payload = (metric: Metric): GraphPayload => ({ nodeId: node.id, metric, name: node.service, color: SERVICE_COLORS[node.service] })
    return [
      { label: "Add to graph menu", icon: <ChartLineIcon />, onSelect: () => dock(payload(Metric.Served)) },
      {
        label: "Detailed graph",
        icon: <SquaresFourIcon />,
        onSelect: () => (Object.keys(METRICS) as Metric[]).forEach((metric, i) => dock(payload(metric), GRID + i * CARD_W)),
      },
      { label: "Delete", icon: <TrashIcon />, danger: true, onSelect: () => graphStore.removeNode(node.id) },
    ]
  }

  const onSelectPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const island = (e.target as HTMLElement).closest<HTMLElement>("[data-island-id]")
      setSelectedId(island?.dataset.islandId ?? null)
    },
    [setSelectedId],
  )

  const handleDragStart = (e: DragEvent<HTMLDivElement>, service: ServiceType) => {
    e.dataTransfer.setData("text/service", service)
    e.dataTransfer.effectAllowed = "copy"
    const ghostContainer = document.createElement("div")
    ghostContainer.style.position = "absolute"
    ghostContainer.style.top = "-9999px"
    ghostContainer.style.left = "-9999px"
    ghostContainer.style.pointerEvents = "none"
    document.body.appendChild(ghostContainer)
    const icon = PALETTE.find((item) => item.service === service)?.icon
    const root = createRoot(ghostContainer)
    root.render(
      <div
        style={{ backgroundColor: SERVICE_COLORS[service] }}
        className="flex items-center gap-2 px-4 py-1 text-xl text-white border border-border"
      >
        {icon && <img src={icon} alt="" className="size-6" />}
        {service}
      </div>,
    )
    setTimeout(() => {
      e.dataTransfer.setDragImage(ghostContainer, 32, 32)
      setTimeout(() => {
        root.unmount()
        ghostContainer.remove()
      }, 0)
    }, 0)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setHovering(false)
    const service = e.dataTransfer.getData("text/service")
    if (!isService(service)) return
    const board = e.currentTarget
    const rect = board.getBoundingClientRect()
    const scale = board.offsetWidth > 0 ? rect.width / board.offsetWidth : 1
    const frame = document
      .elementsFromPoint(e.clientX, e.clientY)
      .map((element) => (element as HTMLElement).closest<HTMLElement>("[data-frame]"))
      .find(Boolean)

    const parentId = frame?.dataset.frame ?? null
    const x = parentId ? 0 : (e.clientX - rect.left) / scale - 32
    const y = parentId ? 0 : (e.clientY - rect.top) / scale - 32

    graphStore.addNode(service, { x, y }, parentId)
  }

  const renderPlacedNode = (node: GraphNode) => {
    const Service = SERVICES[node.service]
    const { x, y } = node.position ?? { x: 0, y: 0 }

    const content = (
      <div data-island-id={node.id} data-selected={selectedId === node.id || undefined} className="contents">
        <Service
          id={node.id}
          style={!node.parentId || node.service === ServiceType.Region ? at(x, y) : undefined}
        />
      </div>
    )

    if (!node.parentId) {
      return <div key={node.id} className="contents">{content}</div>
    }

    const body = frameBodies.get(node.parentId)

    if (!body) {
      return null
    }

    return createPortal(content, body, node.id)
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-background">
      <Group orientation="vertical" className="w-full h-full">
        <Panel defaultSize="85%" minSize="50%">
          <Group orientation="horizontal" className="w-full h-full">
            <Panel defaultSize="15%" minSize="10%" maxSize="30%" className="bg-gray-50/10">
              <section className="h-full w-full p-4 flex flex-col gap-2 overflow-y-auto">
                <div className="text-sm font-semibold mb-2 text-white">Services</div>

                {PALETTE.map(({ service, icon }) => (
                  <div
                    key={service}
                    draggable
                    onDragStart={(e) => handleDragStart(e, service)}
                    className={sidebarItem}
                  >
                    {icon && <img src={icon} alt="" className={sidebarIcon} />}
                    {service}
                  </div>
                ))}
              </section>
            </Panel>

            <Separator className="w-[0.25] bg-gray-200 hover:bg-blue-500 transition-colors duration-150 cursor-col-resize" />

            <Panel defaultSize="85%" className="relative">
              <SimulationBar />
              <Viewport>
                <div
                  data-island-board
                  onPointerDownCapture={onSelectPointerDown}
                  onContextMenu={onBoardContextMenu}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes("text/service")) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "copy"
                    setHovering(true)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setHovering(false)
                  }}
                  onDrop={onDrop}
                  className={board(hovering)}
                >
                  <EdgeLayer>{nodes.map(renderPlacedNode)}</EdgeLayer>
                </div>
              </Viewport>
            </Panel>
          </Group>
        </Panel>

        <Separator className="h-[0.25] bg-gray-200 hover:bg-blue-500 transition-colors duration-150 cursor-row-resize" />

        <Panel
          defaultSize="25%"
          minSize="0%"
          maxSize="40%"
          className="bg-gray-50/5 flex flex-col"
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(GRAPH_MIME)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = "copy"
          }}
          onDrop={onGraphDrop}
        >
          <section className="flex-1 min-h-0 w-full relative overflow-hidden p-4">
            {docked.length === 0 && (
              <div className="h-full w-full grid place-items-center text-sm text-neutral-500 font-mono select-none pointer-events-none">
                Drag a graph from a service to view the graphs here
              </div>
            )}
            {docked.map((item) => (
              <DockedGraphCard key={item.id} item={item} cards={dockedCards} onMove={moveDocked} />
            ))}
          </section>
        </Panel>
      </Group>

      {menu && <ContextMenu at={menu.at} items={menuItems(menu.node)} onClose={() => setMenu(null)} />}
    </div>
  )
}
