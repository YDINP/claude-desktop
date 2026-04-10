import { useState, useCallback } from 'react'

/**
 * Clipboard copy with auto-reset visual feedback.
 *
 * Usage:
 *   const { copiedKey, isCopied, copy } = useCopyToClipboard()
 *   copy(text, 'some-id')   // sets copiedKey = 'some-id'
 *   isCopied('some-id')     // true for `timeout` ms
 *
 * For simple single-value usage (no key):
 *   copy(text)              // sets copiedKey = 'default'
 *   isCopied()              // true for `timeout` ms
 */
export function useCopyToClipboard(timeout = 1500) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copy = useCallback(
    async (text: string, key?: string) => {
      await navigator.clipboard.writeText(text)
      const k = key ?? 'default'
      setCopiedKey(k)
      setTimeout(() => setCopiedKey(prev => (prev === k ? null : prev)), timeout)
    },
    [timeout],
  )

  const isCopied = useCallback(
    (key?: string) => copiedKey === (key ?? 'default'),
    [copiedKey],
  )

  return { copiedKey, isCopied, copy }
}
