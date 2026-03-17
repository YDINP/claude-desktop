/**
 * Cocos Adapter — IPC 이벤트 → Cocos Store 업데이트
 * ccFile* IPC 이벤트 → Kernel 이벤트 or 직접 store 업데이트
 * Phase C: window.api 직접 구독 (IpcBridge 통합은 Phase D)
 */
import { useCocosStore } from './store'
import type { CCStatus, CCEvent } from '../../../../shared/ipc-schema'

export function initCocosAdapter(): () => void {
  const cleanups: (() => void)[] = []
  const api = window.api
  if (!api) return () => {}

  const store = () => useCocosStore.getState()

  // CC 라이브 연결 이벤트
  if (api.onCCStatusChange) {
    const unsub = api.onCCStatusChange((status: unknown) => {
      const s = status as CCStatus
      store().setStatus(s)
      store().setConnected(s.connected)
      if (s.port) store().setPort(s.port)
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  if (api.onCCEvent) {
    const unsub = api.onCCEvent((event: unknown) => {
      const ev = event as CCEvent
      if (ev.type === 'connected') {
        store().setConnected(true)
      }
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // CC 파일 변경 감시 이벤트
  if (api.onCCFileChanged) {
    const unsub = api.onCCFileChanged((_path: unknown) => {
      // 외부 파일 변경 감지 — CocosPanel이 자체적으로 처리
      // 필요 시 store에 externalChangePath 추가 가능
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  return () => cleanups.forEach(fn => fn())
}
