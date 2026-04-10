import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' })

let mermaidId = 0

interface Props {
  code: string
}

export function MermaidBlock({ code }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(`mermaid-${++mermaidId}`)

  useEffect(() => {
    if (!ref.current) return
    setError(null)
    mermaid.render(idRef.current, code)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg
      })
      .catch((e: Error) => {
        setError(e.message)
      })
  }, [code])

  if (error) {
    return (
      <pre style={{ color: 'var(--error, #f44336)', fontSize: 12, padding: 8 }}>
        Mermaid error: {error}
      </pre>
    )
  }

  return (
    <div
      ref={ref}
      style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, overflowX: 'auto', margin: '8px 0' }}
    />
  )
}
