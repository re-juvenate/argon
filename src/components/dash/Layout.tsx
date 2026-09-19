import { useEffect, useState, type CSSProperties, type ComponentType, type DragEvent } from "react"
import { createRoot } from "react-dom/client"
import { Group, Panel, Separator } from "react-resizable-panels"
import clsx from "clsx"

import { ServiceType } from "../../types/math"
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

const DELETION_KEYS = new Set(["Backspace", "Delete"])

interface NodeComponentProps {
  style?: CSSProperties
  id?: string
  selected?: boolean
}

const SERVICES: Record<ServiceType, ComponentType<NodeComponentProps>> = {
  [ServiceType.EC2]: EC2,
  [ServiceType.ECS]: Fargate,
  [ServiceType.ASG]: (props) => <ASG n={8} {...props} />,
  [ServiceType.LB]: ELB,
  [ServiceType.SQS]: SQS,
  [ServiceType.Lambda]: Lambda,
  [ServiceType.S3]: S3,
  [ServiceType.CloudFront]: Cloudfront,
  [ServiceType.Route53]: Route53,
  [ServiceType.Aurora]: Aurora,
}

interface Placed {
  id: string
  service: ServiceType
  x: number
  y: number
}

const sidebarItem = clsx(
  "px-3 py-2 bg-neutral-800 text-white rounded text-sm font-mono select-none",
  "cursor-grab active:cursor-grabbing hover:bg-neutral-700 transition-colors",
)

const board = (hovering: boolean) =>
  clsx(
    "relative w-full h-full overflow-hidden bg-background transition-shadow duration-150",
    hovering && "shadow-[inset_0_0_0_2px_var(--color-blueprimary)]",
  )

export default function Layout() {
  const [placed, setPlaced] = useState<Placed[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!DELETION_KEYS.has(e.key)) return
      const target = e.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? ""))
        return
      setPlaced((nodes) => nodes.filter(({ id }) => id !== selectedId))
      setSelectedId(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedId])

  const handleDragStart = (e: DragEvent<HTMLDivElement>, service: ServiceType) => {
    e.dataTransfer.setData("text/service", service)
    e.dataTransfer.effectAllowed = "copy"

    const ghostContainer = document.createElement("div")
    ghostContainer.style.position = "absolute"
    ghostContainer.style.top = "-9999px"
    ghostContainer.style.left = "-9999px"
    ghostContainer.style.pointerEvents = "none"
    document.body.appendChild(ghostContainer)

    const ServiceComponent = SERVICES[service]
    const root = createRoot(ghostContainer)

    root.render(<ServiceComponent />)

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
    const service = e.dataTransfer.getData("text/service") as ServiceType
    if (!(service in SERVICES)) return
    const rect = e.currentTarget.getBoundingClientRect()

    setPlaced((nodes) => [
      ...nodes,
      {
        id: crypto.randomUUID(),
        service,
        x: e.clientX - rect.left - 32,
        y: e.clientY - rect.top - 32,
      },
    ])
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-background">
      <Group orientation="vertical" className="w-full h-full">
        <Panel defaultSize="85%" minSize="50%">
          <Group orientation="horizontal" className="w-full h-full">
            <Panel defaultSize="15%" minSize="10%" maxSize="30%" className="bg-gray-50/10">
              <section className="h-full w-full p-4 flex flex-col gap-2 overflow-y-auto">
                <div className="text-sm font-semibold mb-2 text-white">Services</div>
                {Object.values(ServiceType).map((service) => (
                  <div
                    key={service}
                    draggable
                    onDragStart={(e) => handleDragStart(e, service)}
                    className={sidebarItem}
                  >
                    {service}
                  </div>
                ))}
              </section>
            </Panel>

            <Separator className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors duration-150 cursor-col-resize" />

            <Panel defaultSize="85%">
              <div
                data-island-board
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "copy"
                  setHovering(true)
                }}
                onDragLeave={() => setHovering(false)}
                onDrop={onDrop}
                className={board(hovering)}
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
                  {placed.map(({ id, service, x, y }) => {
                    const Service = SERVICES[service]
                    return (
                      <div key={id} onPointerDown={() => setSelectedId(id)}>
                        <Service style={at(x, y)} id={id} selected={selectedId === id} />
                      </div>
                    )
                  })}
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
