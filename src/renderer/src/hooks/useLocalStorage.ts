import { useState, useCallback, useEffect } from 'react'

/**
 * Persist state in localStorage with JSON serialization.
 *
 * Reads once on mount (with try/catch), writes on every change.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (val: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // quota exceeded — silently ignore
    }
  }, [key, value])

  const set = useCallback(
    (val: T | ((prev: T) => T)) => setValue(val),
    [],
  )

  return [value, set]
}
