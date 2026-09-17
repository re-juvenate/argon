import { useState, useMemo } from "react";
import type { ChangeEvent } from "react";
const SLIDER_PRECISION = {
  STEP: 0.001,
  DECIMALS: 3,
} as const;

export interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange?: (value: number) => void;
}

export default function Slider({ label, min, max, step, defaultValue, onChange }: SliderProps) {
  const [value, setValue] = useState<number>(defaultValue);

  const fillPercentage = useMemo(() => {
    const totalRange = max - min;
    if (totalRange <= 0) return 0;
    return ((value - min) / totalRange) * 100;
  }, [value, min, max]);

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <div className="relative flex items-center h-7 bg-[#2e2e2e] border border-[#151515] rounded overflow-hidden select-none cursor-ew-resize group">
      <div
        className="absolute top-0 left-0 h-full bg-[#3d6ca4] group-hover:bg-[#477cb9] transition-colors duration-150"
        style={{ width: `${fillPercentage}%` }}
      />

      <div className="absolute inset-0 flex justify-between items-center px-3 text-sm text-[#e0e0e0] font-sans pointer-events-none z-10">
        <span className="tracking-wide">{label}</span>
        <span className="font-mono">{value.toFixed(SLIDER_PRECISION.DECIMALS)}</span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleSliderChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
      />
    </div>
  );
}
