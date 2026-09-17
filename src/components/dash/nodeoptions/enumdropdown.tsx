// USAGE:
//
// <EnumDropdown
//   label="Subsurface Method"
//   optionNames={["Christensen-Burley", "Random Walk", "Random Walk (Skin)"]}
// >
//   {/* Index 0 Layout: Christensen-Burley */}
//   <>
//     <Slider label="Subsurface Scale" min={0} max={2} defaultValue={1.0} />
//     <Boolean label="Use Subsurface Fac" defaultChecked={false} />
//   </>
//   {/* Index 1 Layout: Random Walk */}
//   <>
//     <Slider label="Subsurface Scale" min={0} max={2} defaultValue={1.0} />
//     <Slider label="Anisotropic Rotation" min={0} max={1} defaultValue={0.45} />
//   </>
//   {/* Index 2 Layout: Random Walk (Skin) */}
//   <>
//     <Slider label="Subsurface Scale" min={0} max={5} defaultValue={2.5} />
//     <Slider label="Skin Hemoglobin" min={0} max={1} defaultValue={0.8} />
//     <Boolean label="Restrict Radius Bounds" defaultChecked={true} />
//   </>
// </EnumDropdown>

import { useState } from "react";
import Dropdown from "./dropdown";
import type { Option } from "./dropdown";

interface EnumDropdownProps {
  label?: string;
  children: React.ReactNode[];
  optionNames: string[];
}

export default function EnumDropdown({
  label = "Options",
  children,
  optionNames,
}: EnumDropdownProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const generatedOptions: Option[] = optionNames.map((name, index) => ({
    name,
    onSelect: () => setActiveIndex(index),
  }));

  return (
    <div className="w-full space-y-3">
      <Dropdown label={label} options={generatedOptions} />
      <div className="space-y-3 pt-1">{children[activeIndex]}</div>
    </div>
  );
}
