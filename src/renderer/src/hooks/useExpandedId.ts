import { useState, useCallback } from 'react'

/**
 * Toggle a single expanded-item state (accordion pattern).
 */
export function useExpandedId() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggle = useCallback(
    (id: string) => setExpandedId(prev => (prev === id ? null : id)),
    [],
  )

  const isExpanded = useCallback(
    (id: string) => expandedId === id,
    [expandedId],
  )

  return { expandedId, toggle, isExpanded }
}
