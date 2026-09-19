interface PromptProps {
  question: string
  options: string[]
  onSubmit: (option: string) => void
}

const Prompt = ({ question, options, onSubmit }: PromptProps) => {
  return (
    <div>
      <h2>{question}</h2>
      <ul>
        {options.map((option) => (
          <li key={option} onClick={() => onSubmit(option)}>
            {option}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Prompt
