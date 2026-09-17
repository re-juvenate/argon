import { createContext, useContext, useState, Activity, type ReactNode } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr";

interface FrameContextValue {
  name: string;
  collapsed: boolean;
}

const FrameContext = createContext<FrameContextValue | null>(null);

export const useFrame = () => useContext(FrameContext);

interface FrameProps {
  name: string;
  children?: ReactNode;
}

const Frame = ({ name, children }: FrameProps) => {
  const [collapsed, setIsCollapsed] = useState(false);

  return (
    <div className="w-fit border-2 border-dashed border-border flex flex-col">
      <div
        className="text-sm py-1 px-3 text-[#999999] cursor-pointer select-none flex items-center justify-between gap-2"
        onClick={() => setIsCollapsed(!collapsed)}
      >
        <span>{name}</span>
        <span className="text-xs">{collapsed ? <CaretDownIcon /> : <CaretUpIcon />}</span>
      </div>

      <Activity mode={collapsed ? "hidden" : "visible"}>
        <FrameContext.Provider value={{ name, collapsed }}>
          <div className="p-3 flex flex-col gap-2">{children}</div>
        </FrameContext.Provider>
      </Activity>
    </div>
  );
};

export default Frame;
