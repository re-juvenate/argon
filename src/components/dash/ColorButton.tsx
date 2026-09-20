const ColorButton = () => {
  return (
    <div className="relative flex h-fit w-[320px] items-center justify-center overflow-hidden rounded-3xl p-0.75">
      <div className="animate-[spin_6s_linear_infinite] absolute inset-[-25%] bg-[conic-gradient(from_0deg,#ff0000,#ff8700,#ffd300,#00a82d,#0055ff,#9b51e0,#ff0000)]"></div>
      <div className="animate-[spin_6s_linear_infinite] absolute inset-[-25%] bg-[conic-gradient(from_0deg,#ff0000,#ff8700,#ffd300,#00a82d,#0055ff,#9b51e0,#ff0000)] blur-lg opacity-70"></div>
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center rounded-[21px] bg-[#13131a] text-white">
        <h3 className="text-lg font-semibold tracking-wide p-4">Deploy to AWS</h3>
      </div>
    </div>
  )
}

export default ColorButton
