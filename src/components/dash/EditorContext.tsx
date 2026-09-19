import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type RefCallback,
} from "react"

interface EditorContextValue {
  frameBodies: Map<string, HTMLElement>
  registerFrameBody: (id: string, element: HTMLElement | null) => void
  moveNode: (id: string, parentId: string | null, x: number, y: number) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

interface EditorProviderProps {
  children: ReactNode
  moveNode: EditorContextValue["moveNode"]
}

export function EditorProvider({ children, moveNode }: EditorProviderProps) {
  const [frameBodies, setFrameBodies] = useState(() => new Map<string, HTMLElement>())

  const registerFrameBody = useCallback((id: string, element: HTMLElement | null) => {
    setFrameBodies((current) => {
      const next = new Map(current)

      if (element) {
        next.set(id, element)
      } else {
        next.delete(id)
      }

      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      frameBodies,
      registerFrameBody,
      moveNode,
    }),
    [frameBodies, registerFrameBody, moveNode],
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditor() {
  const context = useContext(EditorContext)

  if (!context) {
    throw new Error("useEditor must be used inside EditorProvider")
  }

  return context
}

export function useFrameBody(id: string): RefCallback<HTMLDivElement> {
  const { registerFrameBody } = useEditor()

  return useCallback(
    (element) => {
      registerFrameBody(id, element)
    },
    [id, registerFrameBody],
  )
}
