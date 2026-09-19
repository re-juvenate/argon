interface PromptProps {
  question: string
  options: string[]
  onSubmit: (option: string) => void
  onClose: () => void
}

const Prompt = ({ question, options, onSubmit, onClose }: PromptProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-6 rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-semibold tracking-tight text-center">{question}</h2>
        <ul className="flex flex-col gap-2">
          {options.map((option) => (
            <li
              key={option}
              onClick={() => onSubmit(option)}
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-lg text-zinc-200 transition-all hover:bg-zinc-800 hover:text-white active:scale-[0.98]"
            >
              {option}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default Prompt
