import { useState, useEffect } from 'react'

export function useProjectContext(projectPath: string | null): string | null {
  const [summary, setSummary] = useState<string | null>(null)

  useEffect(() => {
    if (!projectPath) {
      setSummary(null)
      return
    }
    window.api.projectAnalyze?.(projectPath)
      .then(ctx => {
        setSummary(ctx?.summary ?? null)
      })
      .catch(() => {
        setSummary(null)
      })
  }, [projectPath])

  return summary
}
