import { useEffect, useState } from "react";
import { cn } from "cnfast";

interface BlenderCheckboxProps {
  label?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export default function Boolean({
  label = "Boolean",
  defaultChecked = true,
  checked,
  onChange,
}: BlenderCheckboxProps) {
  const [isChecked, setIsChecked] = useState<boolean>(checked ?? defaultChecked);

  useEffect(() => {
    if (checked !== undefined) setIsChecked(checked);
  }, [checked]);

  const handleToggle = () => {
    const nextState = !isChecked;
    setIsChecked(nextState);
    onChange?.(nextState);
  };

  return (
    <label className="flex items-center gap-2 cursor-pointer group w-fit">
      <div className="relative">
        <input type="checkbox" checked={isChecked} onChange={handleToggle} className="sr-only" />
        <div
          className={cn(
            "w-4.5 h-4.5 rounded-sm border flex items-center justify-center transition-colors",
            isChecked
              ? "bg-[#3d6ca4] border-[#2a4d77] group-hover:bg-[#477cb9]"
              : "bg-[#2e2e2e] border-[#444444] group-hover:bg-[#353535]",
          )}
        >
          {isChecked && (
            <svg
              className="w-3.5 h-3.5 text-white stroke-[3.5]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-[#e0e0e0] tracking-wide text-sm">{label}</span>
    </label>
  );
}
