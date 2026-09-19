import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import Frame from "../../Frame"
import Node from "../../Node"
import { serviceIcon } from "../../icons"
import { SERVICE_COLORS } from "../../colors"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import { ASG_DEFAULTS, type ASGConfig, type ASGState } from "#math/asg/throughput"
import { useNodeResult } from "../../Simulation"
import Dropdown, { type Option } from "../../nodeoptions/dropdown"
import Slider from "../../nodeoptions/slider"
import { EC2InstanceType } from "../../nodes/ec2/instancetype"
import { EC2PlanType } from "../../nodes/ec2/plantype"

gsap.registerPlugin(useGSAP)

const NO_SOCKETS: never[] = []

const ASG = ({ style, id, count }: { style?: CSSProperties; id?: string; count?: number }) => {
  const [config, patch, nodeId] = useNodeConfig<ASGConfig>(ServiceType.ASG, ASG_DEFAULTS, id)
  const { result } = useNodeResult(nodeId)
  const live = (result?.state as ASGState | undefined)?.scale.level
  const n = Math.max(0, Math.round(count ?? live ?? config.inServiceCount ?? ASG_DEFAULTS.inServiceCount))
  const instanceOptions: Option[] = [
    EC2InstanceType.T3_LARGE,
    ...Object.values(EC2InstanceType).filter((t) => t !== EC2InstanceType.T3_LARGE),
  ].map((name) => ({ name, onSelect: () => patch({ instanceType: name }) }))
  const planOptions: Option[] = [
    EC2PlanType.ON_DEMAND,
    ...Object.values(EC2PlanType).filter((p) => p !== EC2PlanType.ON_DEMAND),
  ].map((name) => ({ name, onSelect: () => patch({ plan: name }) }))
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
    <div ref={containerRef} className="contents">
      <Frame
        id={nodeId}
        name="ASG"
        icon={serviceIcon("asg.svg")}
        style={style}
        sockets
        droppable={false}
        visibleChildren={
          <>
            <Dropdown label="Instance Type" options={instanceOptions} value={config.instanceType} />
            <Dropdown label="Purchasing Plan" options={planOptions} value={config.plan} />
            <Slider
              label="In Service"
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
        {instances.map((instance) => (
          <div key={instance} data-instance={instance} className="itemmmmy">
            <Node
              name="EC2"
              color={SERVICE_COLORS[ServiceType.EC2]}
              icon={serviceIcon("ec2.svg")}
              sockets={NO_SOCKETS}
              draggable={false}
              visibleChildren={<span className="text-xs text-[#999999]">{config.instanceType}</span>}
            />
          </div>
        ))}
      </Frame>
    </div>
  )
}

export default ASG
