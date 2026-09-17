interface NodeProps {
  name: string;
  color: string;
  children?: React.ReactNode;
}

const Node = ({ name, color, children }: NodeProps) => {
  return (
    <div className="w-fit min-w-48 h-auto border border-border flex flex-col bg-node pb-2 gap-2">
      <div style={{ backgroundColor: color }} className="text-center text-xl py-1">
        {name}
      </div>
      <div className="flex flex-col px-2 flex-1 gap-2">{children}</div>
    </div>
  );
};

export default Node;
