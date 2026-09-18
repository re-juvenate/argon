import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr";
import { useIsland } from "./Island";

interface NodeProps {
  name: string;
  color: string;
  style?: CSSProperties;
  visibleChildren?: ReactNode;
  children?: ReactNode;
}

const Node = ({ name, color, style, visibleChildren, children }: NodeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const islandRef = useIsland<HTMLDivElement>({ flow: true, handle: headerRef });

  return (
    <div
      ref={islandRef}
      style={style}
      className="w-fit min-w-48 h-auto border border-border flex flex-col bg-node pb-2 gap-2"
    >
      <div
        ref={headerRef}
        style={{ backgroundColor: color }}
        className="text-xl py-1 px-4 cursor-pointer select-none hover:opacity-90 flex items-center justify-between gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{name}</span>
        {children && (
          <span className="text-sm">{isOpen ? <CaretUpIcon /> : <CaretDownIcon />}</span>
        )}
      </div>

      <div className="flex flex-col px-2 flex-1 gap-2">
        {visibleChildren}
        {children && (isOpen ? <div className="flex flex-col gap-2">{children}</div> : null)}
      </div>
    </div>
  );
};

export default Node;
