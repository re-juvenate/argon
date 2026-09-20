import clsx from "clsx"

const ColorButton = ({ label = "Deploy to AWS", compact = false, onClick }: { label?: string; compact?: boolean; onClick?: () => void }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "relative flex h-fit items-center justify-center overflow-hidden p-0.5 select-none cursor-pointer",
        compact ? "rounded-lg min-w-40 min-h-12" : "w-[320px] rounded-3xl p-0.75",
      )}
    >
      <div className="animate-[spin_6s_linear_infinite] absolute inset-[-25%] bg-[conic-gradient(from_0deg,#ff0000,#ff8700,#ffd300,#00a82d,#0055ff,#9b51e0,#ff0000)]"></div>
      <div className="animate-[spin_6s_linear_infinite] absolute inset-[-25%] bg-[conic-gradient(from_0deg,#ff0000,#ff8700,#ffd300,#00a82d,#0055ff,#9b51e0,#ff0000)] blur-lg opacity-70"></div>
      <div className={clsx("relative z-10 flex h-full w-full items-center justify-center bg-[#13131a] text-white", compact ? "rounded-[6px] min-h-11 px-4 text-sm font-semibold tracking-wide whitespace-nowrap" : "rounded-[21px]")}>
        {compact ? label : <h3 className="text-lg font-semibold tracking-wide p-4">{label}</h3>}
      </div>
    </button>
  )
}

export default ColorButton
