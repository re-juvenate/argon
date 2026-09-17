import { useState, Activity, forwardRef } from "react";
import type { ReactNode } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr";
import { useFrame } from "./Frame";
import cn from "cnfast";

interface NodeProps {
  name: string;
  color: string;
  visibleChildren?: ReactNode;
  children?: ReactNode;
  parent?: ReactNode;
}

const Node = forwardRef<HTMLDivElement, NodeProps>(
  ({ name, color, visibleChildren, children, parent }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const inFrame = useFrame();

    return (
      <div
        ref={ref}
        className={cn(
          "w-fit min-w-48 h-auto border border-border flex flex-col bg-node pb-2 gap-2",
          !inFrame && "draggable-node absolute",
        )}
      >
        <div
          style={{ backgroundColor: color }}
          className={cn(
            "text-xl py-1 px-4 cursor-pointer select-none hover:opacity-90 flex items-center justify-between gap-2",
            !inFrame && "draggable-node-handle",
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{name}</span>
          {children && (
            <span className="text-sm">{isOpen ? <CaretUpIcon /> : <CaretDownIcon />}</span>
          )}
        </div>

        <div className="flex flex-col px-2 flex-1 gap-2">
          {visibleChildren}
          {children && (
            <Activity mode={isOpen ? "visible" : "hidden"}>
              <div className="flex flex-col gap-2">{children}</div>
            </Activity>
          )}
        </div>
      </div>
    );
  },
);

Node.displayName = "Node";

export default Node;
