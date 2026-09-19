import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr";
import { useIsland } from "./Island";
import { useFrameBody } from "./EditorContext";
import { Socket } from "./Edge";
import { SocketType } from "../../types/nodes";
import cn from "cnfast";
import Stats from "./Stats";
import { useNodeResult } from "./Simulation";

interface FrameProps {
  id: string;
  name: string;
  icon?: string;
  style?: CSSProperties;
  sockets?: boolean;
  droppable?: boolean;
  visibleChildren?: ReactNode;
  children?: ReactNode;
}

const Frame = ({ id, name, icon, style, sockets = false, droppable = true, visibleChildren, children }: FrameProps) => {
  const [collapsed, setIsCollapsed] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const islandRef = useIsland<HTMLDivElement>({ handle: headerRef });
  const bodyRef = useFrameBody(id);
  const { result } = useNodeResult(sockets ? id : undefined);

  return (
    <div
      ref={islandRef}
      style={style}
      data-frame={id}
      data-id={id}
      className="w-fit border-2 border-dashed border-[#147eba] flex flex-col relative"
    >
      <div
        ref={headerRef}
        className="text-sm py-1 px-3 text-[#999999] cursor-pointer select-none flex items-center justify-between gap-2"
        onClick={() => setIsCollapsed(!collapsed)}
      >
        <span className="flex items-center gap-2">
          {icon && <img src={icon} alt="" className="size-4 shrink-0" draggable={false} />}
          {name}
        </span>
        <span className="text-xs">{collapsed ? <CaretDownIcon /> : <CaretUpIcon />}</span>
      </div>

      {(result || visibleChildren) && (
        <div className="px-3 pb-2 flex flex-col gap-2">
          <Stats result={result} nodeId={id} name={name} color="#147eba" />
          {visibleChildren}
        </div>
      )}

      <div
        ref={droppable ? bodyRef : undefined}
        data-frame-body
        className={cn("p-3 flex flex-col gap-2 max-h-[60vh] max-w-[70vw] overflow-auto [[data-dragging]_&]:overflow-visible", collapsed && "hidden")}
      >
        {children}
      </div>

      {sockets && (
        <>
          <Socket type={SocketType.Input} />
          <Socket type={SocketType.Output} />
        </>
      )}
    </div>
  );
};

export default Frame;
