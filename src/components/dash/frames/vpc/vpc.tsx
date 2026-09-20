import type { CSSProperties } from "react"
import Frame from "../../Frame"
import { serviceIcon } from "../../icons"
import { useNodeConfig } from "#graph"
import { ServiceType } from "../../../../types/math"
import { VPC_DEFAULTS, type VPCConfig } from "#math/vpc/throughput"

export const VPC_SIZE = 380

const VPC = ({ style, id }: { style?: CSSProperties; id?: string }) => {
  const [config, patch, nodeId] = useNodeConfig<VPCConfig>(ServiceType.VPC, VPC_DEFAULTS, id)

  return (
    <Frame
      id={nodeId}
      name={`VPC ${config.cidr}`}
      icon={serviceIcon("vpc.svg")}
      style={{ minWidth: VPC_SIZE, minHeight: 240, ...style }}
      visibleChildren={
        <>
          <div className="text-sm text-gray-300 font-mono text-center">
            Virtual Private Cloud
          </div>
          <div className="flex flex-col gap-1 mt-2">
             <label className="text-xs text-gray-400 font-medium">CIDR Block</label>
             <input 
               type="text" 
               value={config.cidr} 
               onChange={(e) => patch({ cidr: e.target.value })} 
               className="bg-[#2a2a2a] border border-[#444] text-gray-200 text-sm px-2 py-1 rounded outline-none focus:border-blueprimary"
             />
          </div>
        </>
      }
    />
  )
}

export default VPC
