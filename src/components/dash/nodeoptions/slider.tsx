import { useState, useMemo, useRef, useEffect } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

export interface SliderProps {
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  step?: number;
  decimals?: number;
  onChange?: (value: number) => void;
}

export default function Slider({
  label,
  min,
  max,
  defaultValue,
  step = 0.001,
  decimals = 3,
  onChange,
}: SliderProps) {
  const [value, setValue] = useState<number>(defaultValue);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Widest text the value slot can ever show, so the node's w-fit sizing
  // reserves room for it (same trick as the dropdown's width sizer):
  // "-" for the sign, one extra decimal of padding, monospace keeps it exact.
  const widestValue = useMemo(() => {
    const bound = Math.max(Math.abs(min), Math.abs(max));
    const widest = Math.max(bound + step, 1);
    return `-${widest.toFixed(decimals + 1)}`;
  }, [min, max, step, decimals]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const fillPercentage = useMemo(() => {
    const totalRange = max - min;
    if (totalRange <= 0) return 0;
    return ((value - min) / totalRange) * 100;
  }, [value, min, max]);

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      setValue(newValue);
      onChange?.(newValue);
    }
  };

  const handleEnableEditing = () => {
    setInputValue(value.toString());
    setIsEditing(true);
  };

  const handleCommitValue = () => {
    let newValue = parseFloat(inputValue);
    if (isNaN(newValue)) {
      newValue = defaultValue;
    }
    const clampedValue = Math.max(min, Math.min(max, newValue));

    setValue(clampedValue);
    onChange?.(clampedValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleCommitValue();
    if (e.key === "Escape") setIsEditing(false);
  };

  return (
    <div
      className="relative flex items-center h-7 bg-[#2e2e2e] border border-[#151515] rounded overflow-hidden select-none group"
      onDoubleClick={handleEnableEditing}
    >
      {/* Invisible in-flow sizer: label + widest value. Everything visible in
          this row is absolutely positioned (zero intrinsic width), so without
          this the node's w-fit sizing would never reserve room for either. */}
      <div
        aria-hidden
        className="invisible h-0 overflow-hidden whitespace-nowrap flex justify-between gap-2 px-3 text-sm font-sans"
      >
        <span className="tracking-wide">{label}</span>
        <span className="font-mono">{widestValue}</span>
      </div>
      {!isEditing ? (
        <>
          <div
            className="absolute top-0 left-0 h-full bg-[#3d6ca4] group-hover:bg-[#477cb9] transition-colors duration-150 cursor-ew-resize"
            style={{ width: `${fillPercentage}%` }}
          />

          <div className="absolute inset-0 flex justify-between items-center px-3 text-sm text-[#e0e0e0] font-sans pointer-events-none z-10">
            <span className="tracking-wide whitespace-nowrap">{label}</span>
            <span className="font-mono cursor-text pointer-events-auto">{value.toFixed(decimals)}</span>
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
        </>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleCommitValue}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-[#151515] text-[#e0e0e0] font-mono text-sm px-3 outline-none border-none z-30"
        />
      )}
    </div>
  );
}
