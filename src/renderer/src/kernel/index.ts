/**
 * Kernel public API
 * useKernel() — dispatch 함수 반환
 * useKernelEvent() — 이벤트 구독 훅
 */
import { useCallback, useEffect } from 'react'
import { commandBus } from './commandBus'
import { eventBus } from './eventBus'
import type { AppCommand, AppCommandType, AppEventType, EventPayload } from './types'

export { eventBus } from './eventBus'
export { commandBus } from './commandBus'
export { initIpcBridge, destroyIpcBridge } from './ipcBridge'
export type { AppCommand, AppEvent, AppCommandType, AppEventType, CommandPayload, EventPayload } from './types'

/**
 * @future 커널 커맨드 디스패치 훅. 미래 인프라 확장용으로 의도적으로 노출.
 * dispatch 함수 반환. 컴포넌트에서 커맨드 디스패치 시 사용.
 */
export function useKernel(): <T extends AppCommandType>(
  command: Extract<AppCommand, { type: T }>
) => Promise<unknown> {
  return useCallback(
    (command) => commandBus.dispatch(command),
    []
  )
}

/**
 * @future 커널 이벤트 구독 훅. 미래 인프라 확장용으로 의도적으로 노출.
 * 언마운트 시 자동 해제.
 */
export function useKernelEvent<T extends AppEventType>(
  type: T,
  handler: (payload: EventPayload<T>) => void
): void {
  useEffect(() => {
    return eventBus.on(type, handler)
  }, [type, handler])
}
