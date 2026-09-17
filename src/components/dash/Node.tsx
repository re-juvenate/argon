interface NodeProps {
  name: string;
  color: string;
  children?: React.ReactNode;
}

const Node = ({ name, color, children }: NodeProps) => {
  return (
    <div className="w-fit min-w-48 min-h-32 border border-[#444444] flex flex-col bg-node">
      <div style={{ backgroundColor: color }} className="text-center text-xl">
        {name}
      </div>
      <div className="flex flex-col px-2">{children}</div>
    </div>
  );
};

export default Node;
