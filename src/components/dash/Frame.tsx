import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr";
import { useIsland } from "./Island";
import { Socket } from "./Edge";
import { SocketType } from "../../types/nodes";
import cn from "cnfast";

interface FrameProps {
  name: string;
  icon?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const Frame = ({ name, icon, style, children }: FrameProps) => {
  const [collapsed, setIsCollapsed] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const islandRef = useIsland<HTMLDivElement>({ handle: headerRef });

  return (
    <div
      ref={islandRef}
      style={style}
      data-frame
      className="w-fit border-2 border-dashed border-border flex flex-col relative"
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
