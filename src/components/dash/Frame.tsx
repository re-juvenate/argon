import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr";
import { useIsland } from "./Island";
import { useFrameBody } from "./EditorContext";
import { Socket } from "./Edge";
import { SocketType } from "../../types/nodes";
import cn from "cnfast";

interface FrameProps {
  name: string;
  icon?: string;
  style?: CSSProperties;
  id?: string;
  children?: ReactNode;
}

const Frame = ({ name, icon, style, id, children }: FrameProps) => {
  const [collapsed, setIsCollapsed] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Frames without an explicit id (e.g. Region) still need a stable identity
  // for drop targeting and body registration.
  const fallbackId = useRef<string | null>(null);
  if (fallbackId.current === null) fallbackId.current = crypto.randomUUID();
  const frameId = id ?? fallbackId.current;

  const bodyRef = useFrameBody(frameId);
  const islandRef = useIsland<HTMLDivElement>({ handle: headerRef });

  return (
    <div
      ref={islandRef}
      style={style}
      data-frame={frameId}
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

      <div
        ref={bodyRef}
        data-frame-body
        className={cn("p-3 flex flex-col gap-2", collapsed && "hidden")}
      >
        {children}
      </div>
      <Socket type={SocketType.Input} />
      <Socket type={SocketType.Output} />
    </div>
  );
};

export default Frame;
