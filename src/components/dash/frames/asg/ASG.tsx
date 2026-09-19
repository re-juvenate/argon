import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import Frame from "../../Frame"
import Node from "../../Node"
import { serviceIcon } from "../../icons"
import { SERVICE_COLORS } from "../../colors"
import { childrenOf, useGraph, useNodeConfig, type GraphNode } from "#graph"
import { ServiceType } from "../../../../types/math"
import type { SocketType } from "../../../../types/nodes"
import { ASG_DEFAULTS, pendingInstances, type ASGConfig, type ASGState } from "#math/asg/throughput"
import Slider from "../../nodeoptions/slider"
import { useNodeResult } from "../../Simulation"

gsap.registerPlugin(useGSAP)

const MEMBER_ICONS: Partial<Record<ServiceType, string>> = {
  [ServiceType.EC2]: "ec2.svg",
  [ServiceType.ECS]: "ecs.svg",
}

const MEMBER_NAMES: Partial<Record<ServiceType, string>> = {
  [ServiceType.EC2]: "EC2",
  [ServiceType.ECS]: "Fargate",
}

const NO_SOCKETS: SocketType[] = []

const summary = (member: GraphNode): string => {
  const c = member.config as Record<string, unknown>
  if (member.service === ServiceType.EC2) return String(c.instanceType ?? "")
  if (member.service === ServiceType.ECS) return `${c.vcpu ?? ""} vCPU · ${c.memGiB ?? ""} GiB`
  return ""
}

const Clone = ({ member }: { member: GraphNode }) => (
  <Node
    name={MEMBER_NAMES[member.service] ?? member.service}
    color={SERVICE_COLORS[member.service]}
    icon={MEMBER_ICONS[member.service] ? serviceIcon(MEMBER_ICONS[member.service] as `${string}.svg`) : undefined}
    sockets={NO_SOCKETS}
    draggable={false}
    visibleChildren={<span className="text-xs text-[#999999]">{summary(member)}</span>}
  />
)

const ASG = ({ style, id, count }: { style?: CSSProperties; id?: string; count?: number }) => {
  const [config, patch, nodeId] = useNodeConfig<ASGConfig>(ServiceType.ASG, ASG_DEFAULTS, id)
  const graph = useGraph()
  const members = childrenOf(graph, nodeId)
  const { result } = useNodeResult(nodeId)
  const state = result?.state as ASGState | undefined
  const live = state?.scale.level
  const pending = pendingInstances(state)
  const inService = Math.max(0, Math.round(count ?? live ?? config.inServiceCount ?? ASG_DEFAULTS.inServiceCount))
  const n = members.length === 0 ? inService : Math.max(0, inService - 1)
  const containerRef = useRef<HTMLDivElement>(null)
  const [instances, setInstances] = useState<string[]>([])
  const prevN = useRef(n)

  useEffect(() => {
    setInstances((prev) => {
      if (n > prev.length) {
        return [...prev, ...Array.from({ length: n - prev.length }, () => crypto.randomUUID())]
      }

      return prev
    })
  }, [n])

  useGSAP(
    () => {
      const elements = containerRef.current?.querySelectorAll(".itemmmmy")
      if (!elements) return

      const previous = prevN.current
      const current = Array.from(elements)

      // INCREMENT
      if (n > previous) {
        const added = current.slice(previous)

        gsap.fromTo(
          added,
          {
            scale: 0,
            opacity: 0,
          },
          {
            scale: 1,
            opacity: 1,
            duration: 0.3,
            stagger: 0.05,
            ease: "power2.out",
          },
        )
      }

      prevN.current = n
    },
    {
      dependencies: [instances],
      scope: containerRef,
    },
  )

  useGSAP(
    () => {
      if (n >= prevN.current) return
      const elements = containerRef.current?.querySelectorAll(".itemmmmy")
      if (!elements) return

      const current = Array.from(elements)
      const count = prevN.current - n
      const top = current.slice(0, Math.ceil(count / 2))
      const bottom = current.slice(-Math.floor(count / 2))
      const removed = [...top, ...bottom]

      gsap.to(removed, {
        scale: 0,
        opacity: 0,
        duration: 0.2,
        stagger: 0.05,
        ease: "power2.in",
        onComplete: () => {
          const removeIds = new Set(removed.map((el) => el.getAttribute("data-instance")))

          setInstances((prev) => prev.filter((id) => !removeIds.has(id)))

          prevN.current = n
        },
      })
    },
    {
      dependencies: [n],
      scope: containerRef,
    },
  )

  return (
    <Frame
      id={nodeId}
      name={`ASG${pending > 0 ? ` · ${pending} launching` : ""}`}
      icon={serviceIcon("asg.svg")}
      style={style}
      sockets
      visibleChildren={
        <>
          <div className="flex items-center gap-2 px-1.5 py-1 w-fit bg-node border border-border font-mono text-xs text-gray-200 select-none">
            {members.length === 0 ? (
              <span className="size-4 rounded-sm border border-dashed border-[#555555]" />
            ) : (
              members.map((member) => {
                const file = MEMBER_ICONS[member.service]
                return file ? (
                  <img key={member.id} src={serviceIcon(file as `${string}.svg`)} alt="" className="size-4" draggable={false} />
                ) : (
                  <span key={member.id} className="size-4 rounded-sm" style={{ backgroundColor: SERVICE_COLORS[member.service] }} />
                )
              })
            )}
            <span>× {inService}</span>
          </div>
          <Slider
            label="Initial In Service"
            min={1}
            max={64}
            step={1}
            decimals={0}
            defaultValue={ASG_DEFAULTS.inServiceCount}
            value={config.inServiceCount}
            onChange={(inServiceCount) => patch({ inServiceCount })}
          />
          <Slider
            label="Min Size (0 = fixed)"
            min={0}
            max={64}
            step={1}
            decimals={0}
            defaultValue={ASG_DEFAULTS.minSize}
            value={config.minSize}
            onChange={(minSize) => patch({ minSize })}
          />
          <Slider
            label="Max Size (0 = fixed)"
            min={0}
            max={128}
            step={1}
            decimals={0}
            defaultValue={ASG_DEFAULTS.maxSize}
            value={config.maxSize}
            onChange={(maxSize) => patch({ maxSize })}
          />
          <Slider
            label="Target Utilization"
            min={0.1}
            max={1}
            step={0.05}
            decimals={2}
            defaultValue={ASG_DEFAULTS.targetUtilization}
            value={config.targetUtilization}
            onChange={(targetUtilization) => patch({ targetUtilization })}
          />
        </>
      }
    >
      <div ref={containerRef} className="order-1 flex flex-col gap-2">
        {instances.map((instance) => (
          <div key={instance} data-instance={instance} className="itemmmmy flex flex-col gap-2">
            {members.length === 0 ? (
              <div className="min-w-48 h-16 border border-dashed border-[#555555] mt-7" />
            ) : (
              members.map((member) => <Clone key={member.id} member={member} />)
            )}
          </div>
        ))}
      </div>
    </Frame>
  )
}

export default ASG
