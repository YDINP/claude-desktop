import { useCallback, useRef } from 'react'

/**
 * fn을 delay ms 디바운싱하는 훅.
 * fn은 ref로 캡처되므로 최신 클로저를 유지하면서도 타이머가 fn 변경으로 리셋되지 않는다.
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
