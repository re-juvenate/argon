import {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  type CSSProperties,
  type ComponentType,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"

import gsap from "gsap"
import { Draggable } from "gsap/Draggable"
import { InertiaPlugin } from "gsap/InertiaPlugin"

import { Group, Panel, Separator } from "react-resizable-panels"
import clsx from "clsx"

import { ServiceType } from "../../types/math"
import EdgeLayer from "./Edge"
import { InstanceCtx } from "./Node"
import Viewport from "./Viewport"
import { GRAPH_MIME, Metric, METRICS, type GraphPayload } from "./metrics"
import ContextMenu, { type MenuAt, type MenuItem } from "./ContextMenu"
import { ChartLineIcon, PencilSimpleIcon, SquaresFourIcon, TrashIcon, Copy } from "@phosphor-icons/react/dist/ssr"

gsap.registerPlugin(Draggable, InertiaPlugin)

import EC2 from "./nodes/ec2/EC2"
import SQS from "./nodes/sqs/SQS"
import ELB from "./nodes/elb/ELB"
import ASG from "./frames/asg/ASG"
import Region from "./frames/region/Region"
import VPC from "./frames/vpc/vpc"
import Client from "./nodes/client/Client"
import Aurora from "./nodes/aurora/aurora"
import Cloudfront from "./nodes/cloudfront/cloudfront"
import Fargate from "./nodes/fargate/fargate"
import Lambda from "./nodes/lambda/lambda"
import Route53 from "./nodes/route53/route53"
import S3 from "./nodes/s3/s3"
import EBS from "./nodes/ebs/ebs"
import EFS from "./nodes/efs/efs"

import { EditorProvider, useEditor } from "./EditorContext"
import { CARD_H, CARD_W, COLUMNS, DEFAULT_DOCKED, DockedGraphPanel, type Docked } from "./GraphPanel"
import { serviceIcon } from "./icons"
import { SERVICE_COLORS } from "./colors"
import { graphStore, useGraph } from "#graph"
import { SimulationProvider } from "./Simulation"
import SimulationBar from "./SimulationBar"
import GraphIo from "./GraphIo"
import BlenderAddMenu from "./BlenderAddMenu"
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
  [ServiceType.EBS]: EBS,
  [ServiceType.EFS]: EFS,
  [ServiceType.Client]: Client,
  [ServiceType.Region]: Region,
  [ServiceType.VPC]: VPC,
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
  [ServiceType.EBS]: "ebs.svg",
  [ServiceType.EFS]: "efs.svg",
  [ServiceType.Client]: "client.svg",
  [ServiceType.Region]: "region.svg",
  [ServiceType.VPC]: "vpc.svg",
}

const PALETTE = Object.values(ServiceType).map((service) => {
  const file = SERVICE_ICON_FILES[service]
  return { service, icon: file ? serviceIcon(file as `${string}.svg`) : undefined }
})

const isService = (value: string): value is ServiceType => (Object.values(ServiceType) as string[]).includes(value)

const ghostCache = new Map<ServiceType, HTMLImageElement>()

const ghostImage = (service: ServiceType): HTMLImageElement => {
  const existing = ghostCache.get(service)
  if (existing) return existing
  const img = new Image()
  img.src = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48"><rect width="96" height="48" rx="8" fill="${SERVICE_COLORS[service]}" stroke="#151515"/><text x="48" y="29" fill="#fff" font-family="monospace" font-size="13" text-anchor="middle">${service}</text></svg>`,
  )}`
  ghostCache.set(service, img)
  return img
}

const sidebarItem = clsx(
  "flex items-center gap-2.5 px-3 py-2 bg-neutral-800 text-white rounded text-sm font-sans font-medium select-none",
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hovering, setHovering] = useState(false)

  return (
    <SimulationProvider>
      <EditorProvider moveNode={moveNode}>
        <Editor selectedIds={selectedIds} setSelectedIds={setSelectedIds} hovering={hovering} setHovering={setHovering} />
      </EditorProvider>
    </SimulationProvider>
  )
}

interface EditorProps {
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
  hovering: boolean
  setHovering: React.Dispatch<React.SetStateAction<boolean>>
}

const SERVICE_CATEGORIES: Record<ServiceType, string> = {
  [ServiceType.EC2]: "Compute",
  [ServiceType.ECS]: "Compute",
  [ServiceType.ASG]: "Compute",
  [ServiceType.Lambda]: "Compute",
  [ServiceType.LB]: "Network",
  [ServiceType.CloudFront]: "Network",
  [ServiceType.Route53]: "Network",
  [ServiceType.S3]: "Storage",
  [ServiceType.EBS]: "Storage",
  [ServiceType.EFS]: "Storage",
  [ServiceType.Aurora]: "Database",
  [ServiceType.SQS]: "Integration",
  [ServiceType.Client]: "Actors",
  [ServiceType.Region]: "Frames",
  [ServiceType.VPC]: "Frames",
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  [ServiceType.EC2]: "EC2",
  [ServiceType.ECS]: "ECS",
  [ServiceType.ASG]: "Auto Scaling Group",
  [ServiceType.Lambda]: "Lambda",
  [ServiceType.LB]: "Load Balancer",
  [ServiceType.CloudFront]: "CloudFront",
  [ServiceType.Route53]: "Route 53",
  [ServiceType.S3]: "S3",
  [ServiceType.EBS]: "EBS",
  [ServiceType.EFS]: "EFS",
  [ServiceType.Aurora]: "Aurora",
  [ServiceType.SQS]: "SQS",
  [ServiceType.Client]: "Client",
  [ServiceType.Region]: "Region",
  [ServiceType.VPC]: "VPC",
}

function Editor({ selectedIds, setSelectedIds, hovering, setHovering }: EditorProps) {
  const { frameBodies } = useEditor()
  const { nodes } = useGraph()

  const [docked, setDocked] = useState<Docked[]>(DEFAULT_DOCKED)
  const [menu, setMenu] = useState<{ at: MenuAt; node: GraphNode } | null>(null)
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null)
  const [dockedMenu, setDockedMenu] = useState<{ at: MenuAt; id: string } | null>(null)
  const [search, setSearch] = useState("")
  const [blenderDragNodeId, setBlenderDragNodeId] = useState<string | null>(null)

  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase()
    const result: Record<string, typeof PALETTE> = {}
    for (const item of PALETTE) {
      if (!item.service.toLowerCase().includes(q)) continue
      const cat = SERVICE_CATEGORIES[item.service] || "Other"
      if (!result[cat]) result[cat] = []
      result[cat].push(item)
    }
    return result
  }, [search])

  const updateDockedLayout = useCallback((changed: Docked[]) => {
    setDocked((items) => {
      let moved = false
      const next = items.map((item) => {
        const update = changed.find((node) => node.id === item.id)
        if (!update || (item.x === update.x && item.y === update.y && item.w === update.w && item.h === update.h)) return item
        moved = true
        return { ...item, x: update.x, y: update.y, w: update.w, h: update.h }
      })
      return moved ? next : items
    })
  }, [])

  const dock = useCallback((payload: GraphPayload, x = 0, y = 0) => {
    setDocked((items) => {
      const taken = new Set(items.map((i) => `${i.x},${i.y}`))
      let px = Math.max(0, Math.min(COLUMNS - CARD_W, x))
      while (taken.has(`${px},${y}`)) px = (px + CARD_W) % (COLUMNS - CARD_W + 1)
      return [
        ...items,
        {
          id: crypto.randomUUID(),
          nodeId: payload.nodeId,
          metric: payload.metric,
          name: payload.name,
          color: payload.color,
          x: px,
          y,
          w: CARD_W,
          h: CARD_H,
        },
      ]
    })
  }, [])

  const onGraphDrop = (e: DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(GRAPH_MIME)
    if (!raw) return

    e.preventDefault()
    e.stopPropagation()

    const payload = JSON.parse(raw) as GraphPayload
    const grid = e.currentTarget.querySelector(".grid-stack")
    if (!grid) return dock(payload)

    const rect = grid.getBoundingClientRect()
    const columnWidth = rect.width / COLUMNS
    const x = Math.max(0, Math.floor((e.clientX - rect.left - (columnWidth * CARD_W) / 2) / columnWidth))
    const y = Math.max(0, Math.floor((e.clientY - rect.top - (48 * CARD_H) / 2) / 48))
    dock(payload, x, y)
  }

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return
    selectedIds.forEach((id) => graphStore.removeNode(id))
    setSelectedIds(new Set())
  }, [selectedIds, setSelectedIds])

  const pointerRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })

  useEffect(() => {
    const move = (e: MouseEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", move)
    return () => window.removeEventListener("mousemove", move)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "")) {
        return
      }

      if (e.key.toLowerCase() === "a" && e.shiftKey) {
        e.preventDefault()
        setAddMenu(pointerRef.current)
        return
      }

      if (DELETION_KEYS.has(e.key)) {
        deleteSelected()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [deleteSelected])

  // Blender-style "cursor follow" for duplicated node
  useEffect(() => {
    if (!blenderDragNodeId) return

    const move = (e: MouseEvent) => {
      const board = document.querySelector("[data-island-board]") as HTMLElement
      if (!board) return
      const rect = board.getBoundingClientRect()
      const scale = board.offsetWidth > 0 ? rect.width / board.offsetWidth : 1
      const x = (e.clientX - rect.left) / scale - 32
      const y = (e.clientY - rect.top) / scale - 32
      graphStore.setPosition(blenderDragNodeId, { x, y })
    }

    const commit = (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const board = document.querySelector("[data-island-board]") as HTMLElement
      if (!board) return
      const rect = board.getBoundingClientRect()
      const scale = board.offsetWidth > 0 ? rect.width / board.offsetWidth : 1
      const x = (e.clientX - rect.left) / scale - 32
      const y = (e.clientY - rect.top) / scale - 32
      const frame = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((el) => (el as HTMLElement).closest<HTMLElement>("[data-frame]"))
        .find((el) => el && el.dataset.frame !== blenderDragNodeId)
      const parentId = frame?.dataset.frame ?? null
      graphStore.place(blenderDragNodeId, { x, y }, parentId)
      setBlenderDragNodeId(null)
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        graphStore.removeNode(blenderDragNodeId)
        setBlenderDragNodeId(null)
      }
    }

    let hasMoved = false
    window.addEventListener("mousemove", move)
    // Only arm the commit listener once the pointer has moved at least a few pixels,
    // so the pointerup/click that closed the context menu doesn't immediately commit placement.
    const armOnMove = () => {
      if (hasMoved) return
      hasMoved = true
      window.addEventListener("click", commit, { capture: true })
    }
    window.addEventListener("mousemove", armOnMove)
    window.addEventListener("keydown", onKey)

    return () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mousemove", armOnMove)
      window.removeEventListener("click", commit, { capture: true })
      window.removeEventListener("keydown", onKey)
    }
  }, [blenderDragNodeId])

  const onBoardContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      const island = (e.target as HTMLElement).closest<HTMLElement>("[data-island-id]")
      const id = island?.dataset.islandId
      const node = id ? graphStore.get().nodes.find((n) => n.id === id) : undefined
      if (!node) return
      e.preventDefault()
      setSelectedIds(new Set([node.id]))
      setMenu({ at: { x: e.clientX, y: e.clientY }, node })
    },
    [setSelectedIds],
  )

  const onDockedContextMenu = useCallback((e: ReactMouseEvent) => {
    const target = e.target as HTMLElement
    const widget = target.closest<HTMLElement>("[data-docked-id]")
    const id = widget?.dataset.dockedId
    if (!id) return
    e.preventDefault()
    setDockedMenu({ at: { x: e.clientX, y: e.clientY }, id })
  }, [])

  const menuItems = (node: GraphNode): MenuItem[] => {
    const payload = (metric: Metric): GraphPayload => ({
      nodeId: node.id,
      metric,
      name: node.name ?? node.service,
      color: SERVICE_COLORS[node.service],
    })
    return [
      {
        label: "Rename",
        icon: <PencilSimpleIcon />,
        input: {
          type: "text",
          value: node.name ?? node.service,
          placeholder: node.service,
          onCommit: (name) => graphStore.renameNode(node.id, name || undefined),
        },
      },
      {
        label: "Duplicate",
        icon: <Copy />,
        onSelect: () => {
          const original = graphStore.get().nodes.find((n) => n.id === node.id)
          if (!original) return
          const newId = graphStore.addNode(
            original.service,
            { x: (original.position?.x ?? 0) + 24, y: (original.position?.y ?? 0) + 24 },
            original.parentId ?? null,
          )
          // Copy config over
          graphStore.setConfig(newId, { ...(original.config ?? {}) })
          setBlenderDragNodeId(newId)
          setMenu(null)
        },
      },
      { label: "Add to graph menu", icon: <ChartLineIcon />, onSelect: () => dock(payload(Metric.Served)) },
      {
        label: "Detailed graph",
        icon: <SquaresFourIcon />,
        onSelect: () =>
          (Object.keys(METRICS) as Metric[]).forEach((metric, i) =>
            dock(payload(metric), (i * CARD_W) % COLUMNS, Math.floor((i * CARD_W) / COLUMNS) * CARD_H),
          ),
      },
      { label: "Delete", icon: <TrashIcon />, danger: true, onSelect: () => graphStore.removeNode(node.id) },
    ]
  }

  const [boxSelect, setBoxSelect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const getDescendants = useCallback(
    (id: string): string[] => {
      const children = nodes.filter((n) => n.parentId === id).map((n) => n.id)
      return [id, ...children.flatMap(getDescendants)]
    },
    [nodes],
  )

  const onSelectPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const island = (e.target as HTMLElement).closest<HTMLElement>("[data-island-id]")
      const id = island?.dataset.islandId
      if (id) {
        const toToggle = getDescendants(id)
        setSelectedIds((prev) => {
          if (e.shiftKey) {
            const next = new Set(prev)
            if (next.has(id)) {
              toToggle.forEach((d) => next.delete(d))
            } else {
              toToggle.forEach((d) => next.add(d))
            }
            return next
          }
          if (prev.has(id)) return prev
          return new Set(toToggle)
        })
        return
      }

      if (e.button !== 0) return

      const startX = e.clientX
      const startY = e.clientY

      const onMove = (ev: PointerEvent) => {
        const x = Math.min(startX, ev.clientX)
        const y = Math.min(startY, ev.clientY)
        const w = Math.abs(ev.clientX - startX)
        const h = Math.abs(ev.clientY - startY)
        setBoxSelect({ x, y, w, h })
      }

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)

        setBoxSelect((box) => {
          if (box && box.w > 5 && box.h > 5) {
            setSelectedIds((prev) => {
              const selected = new Set(ev.shiftKey ? prev : [])
              document.querySelectorAll("[data-island-id] > *").forEach((el) => {
                const rect = el.getBoundingClientRect()
                if (rect.right >= box.x && rect.left <= box.x + box.w && rect.bottom >= box.y && rect.top <= box.y + box.h) {
                  const island = el.closest<HTMLElement>("[data-island-id]")
                  const elId = island?.dataset.islandId
                  if (elId) selected.add(elId)
                }
              })
              return selected
            })
          } else {
            if (!ev.shiftKey) setSelectedIds(new Set())
          }
          return null
        })
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [setSelectedIds],
  )

  const dragDepth = useRef(0)

  useEffect(() => {
    PALETTE.forEach(({ service }) => ghostImage(service))
  }, [])

  const handleDragStart = (e: DragEvent<HTMLDivElement>, service: ServiceType) => {
    e.dataTransfer.setData("text/service", service)
    e.dataTransfer.effectAllowed = "copy"
    e.dataTransfer.setDragImage(ghostImage(service), 48, 24)
    dragDepth.current = 0
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
    const x = (e.clientX - rect.left) / scale - 32
    const y = (e.clientY - rect.top) / scale - 32

    graphStore.addNode(service, { x, y }, parentId)
  }

  const renderPlacedNode = (node: GraphNode) => {
    const Service = SERVICES[node.service]
    const { x, y } = node.position ?? { x: 0, y: 0 }

    const content = (
      <div data-island-id={node.id} data-selected={selectedIds.has(node.id) || undefined} className="contents">
        <Service id={node.id} style={!node.parentId || node.service === ServiceType.Region ? at(x, y) : undefined} />
      </div>
    )

    if (!node.parentId) {
      return (
        <div key={node.id} className="contents">
          {content}
        </div>
      )
    }

    const body = frameBodies.get(node.parentId)

    if (!body) {
      return null
    }

    const parent = nodes.find((n) => n.id === node.parentId)
    const inAsg = parent?.service === ServiceType.ASG

    return createPortal(<InstanceCtx.Provider value={inAsg}>{content}</InstanceCtx.Provider>, body, node.id)
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-background">
      <Group orientation="vertical" className="w-full h-full">
        <Panel defaultSize="85%" minSize="50%">
          <Group orientation="horizontal" className="w-full h-full">
            <Panel defaultSize="15%" minSize="10%" maxSize="30%" className="bg-gray-50/10">
              <section
                className="h-full w-full p-4 flex flex-col gap-4 overflow-y-auto scrollbar-thin"
                style={{ scrollbarWidth: "thin", scrollbarColor: "#444444 #181818" }}
              >
                <div className="text-sm font-semibold text-white">Services</div>

                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-neutral-800 text-white rounded px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blueprimary transition-all border border-neutral-700"
                />

                {Object.entries(filteredCategories).map(([category, items]) => (
                  <div key={category} className="flex flex-col gap-2">
                    <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mt-2 mb-1">{category}</div>
                    {items.map(({ service, icon }) => (
                      <div key={service} draggable onDragStart={(e) => handleDragStart(e, service)} className={sidebarItem}>
                        {icon && <img src={icon} alt="" className={sidebarIcon} />}
                        {SERVICE_LABELS[service] || service}
                      </div>
                    ))}
                  </div>
                ))}
                {Object.keys(filteredCategories).length === 0 && (
                  <div className="text-xs text-neutral-500 font-mono text-center mt-4">No results</div>
                )}
              </section>
            </Panel>

            <Separator className="w-[0.25] bg-gray-200 hover:bg-blue-500 transition-colors duration-150 cursor-col-resize" />

            <Panel defaultSize="85%" className="relative">
              <div className="absolute right-4 top-4 z-50 flex flex-col gap-2">
                <SimulationBar />
                <GraphIo />
              </div>
              <Viewport>
                <div
                  data-island-board
                  onPointerDownCapture={onSelectPointerDown}
                  onContextMenu={onBoardContextMenu}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes("text/service")) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "copy"
                  }}
                  onDragEnter={(e) => {
                    if (!e.dataTransfer.types.includes("text/service")) return
                    e.preventDefault()
                    dragDepth.current += 1
                    setHovering(true)
                  }}
                  onDragLeave={() => {
                    dragDepth.current = Math.max(0, dragDepth.current - 1)
                    if (dragDepth.current === 0) setHovering(false)
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
          <section className="flex-1 min-h-0 w-full relative overflow-hidden p-4" onContextMenu={onDockedContextMenu}>
            {docked.length === 0 && (
              <div className="absolute inset-0 grid place-items-center text-sm text-neutral-500 font-mono select-none pointer-events-none">
                Drag a graph from a service to view the graphs here
              </div>
            )}

            <DockedGraphPanel items={docked} onChange={updateDockedLayout} />
          </section>
        </Panel>
      </Group>

      {menu && <ContextMenu at={menu.at} items={menuItems(menu.node)} onClose={() => setMenu(null)} />}

      {dockedMenu && (
        <ContextMenu
          at={dockedMenu.at}
          items={[
            {
              icon: <TrashIcon />,
              label: "Remove Graph",
              danger: true,
              onClick: () => {
                setDocked((prev) => prev.filter((d) => d.id !== dockedMenu.id))
                setDockedMenu(null)
              },
            },
          ]}
          onClose={() => setDockedMenu(null)}
        />
      )}

      {addMenu && (
        <BlenderAddMenu
          at={addMenu}
          items={PALETTE.map((item) => ({
            label: SERVICE_LABELS[item.service] || item.service,
            icon: item.icon,
            category: SERVICE_CATEGORIES[item.service] || "Other",
            onSelect: () => {
              const board = document.querySelector("[data-island-board]") as HTMLElement
              if (!board) return
              const rect = board.getBoundingClientRect()
              const scale = board.offsetWidth > 0 ? rect.width / board.offsetWidth : 1
              const frame = document
                .elementsFromPoint(addMenu.x, addMenu.y)
                .map((element) => (element as HTMLElement).closest<HTMLElement>("[data-frame]"))
                .find(Boolean)
              const parentId = frame?.dataset.frame ?? null
              const x = (addMenu.x - rect.left) / scale - 32
              const y = (addMenu.y - rect.top) / scale - 32
              graphStore.addNode(item.service, { x, y }, parentId)
            },
          }))}
          onClose={() => setAddMenu(null)}
        />
      )}

      {boxSelect && (
        <div
          className="fixed pointer-events-none bg-blueprimary/20 border border-blueprimary z-50"
          style={{
            left: boxSelect.x,
            top: boxSelect.y,
            width: boxSelect.w,
            height: boxSelect.h,
          }}
        />
      )}
    </div>
  )
}
