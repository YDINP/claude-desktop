/**
 * Terminal Adapter — IPC 이벤트 → Terminal Store 업데이트
 *
 * terminal:data 이벤트를 구독하여 store.outputHistory에 누적.
 * ipcBridge가 이미 terminal:data를 eventBus로 라우팅하므로,
 * 어댑터는 eventBus.on('terminal:data')으로 구독한다.
 *
 * 기존 TerminalPanel.tsx의 상태 로직을 점진적으로 이관하기 위한 진입점.
 */
import { useTerminalStore } from './store'
import { eventBus } from '../../kernel/eventBus'
import type { EventPayload } from '../../kernel/types'

export interface TerminalAdapterCallbacks {
  /** 에러 라인 감지 시 */
  onErrorDetected?: (tabId: string, line: string) => void
}

/**
 * Terminal 어댑터 초기화
 * - terminal:data 이벤트 → store.appendOutput
 * - 반환값: cleanup 함수
 */
export function initTerminalAdapter(callbacks?: TerminalAdapterCallbacks): () => void {
  const store = () => useTerminalStore.getState()

  const unsub = eventBus.on('terminal:data', (payload: EventPayload<'terminal:data'>) => {
    const { id, data } = payload
    store().appendOutput(id, data)
  })

  return () => {
    unsub()
  }
}
