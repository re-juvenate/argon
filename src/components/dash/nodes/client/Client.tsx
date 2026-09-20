import type { CSSProperties } from "react"
import Node from "../../Node"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import { SocketType } from "../../../../types/nodes"
import { CLIENT_DEFAULTS, type ClientConfig } from "#math/client/throughput"
import { SERVICE_COLORS } from "../../colors"
import { serviceIcon } from "../../icons"
import Slider from "../../nodeoptions/slider"

const OUTPUT_ONLY = [SocketType.Output]

const Client = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<ClientConfig>(ServiceType.Client, CLIENT_DEFAULTS, id)

  return (
    <Node
      id={nodeId}
      name="Client"
      color={SERVICE_COLORS[ServiceType.Client]}
      icon={serviceIcon("client.svg")}
      style={style}
      sockets={OUTPUT_ONLY}
      visibleChildren={<span className="text-xs text-[#999999]">{config.rps} req/s</span>}
    >
      <Slider
        label="Requests / s"
        min={1}
        max={100000}
        step={1}
        decimals={0}
        defaultValue={CLIENT_DEFAULTS.rps}
        value={config.rps}
        onChange={(rps) => patch({ rps })}
      />
      <Slider
        label="Avg Request (bytes)"
        min={64}
        max={1048576}
        step={64}
        decimals={0}
        defaultValue={CLIENT_DEFAULTS.avgBytes}
        value={config.avgBytes}
        onChange={(avgBytes) => patch({ avgBytes })}
      />
    </Node>
  )
}

export default Client
