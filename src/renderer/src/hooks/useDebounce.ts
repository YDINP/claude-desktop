import { useCallback, useRef } from 'react'

/**
 * Returns a debounced version of `fn` with `delay` ms.
 * `fn` is captured via ref so the latest closure is always used without resetting the timer on each render.
 */
export function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  const fnRef = useRef<T>(fn)
  fnRef.current = fn
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  return useCallback((...args: Parameters<T>) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fnRef.current(...args), delay)
  }, [delay]) as T
}
