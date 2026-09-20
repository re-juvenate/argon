import React from "react"

const Button = ({ label, onClick }: { label: string; onClick: () => void }) => {
  return (
    <button onClick={onClick} className="py-2 px-4 border border-border">
      {label}
    </button>
  )
}

export default Button
