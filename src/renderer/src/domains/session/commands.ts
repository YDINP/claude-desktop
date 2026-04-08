/**
 * Session CommandBus 핸들러 등록
 *
 * session:load / session:delete — 이미 ipcBridge에서 IPC 호출 등록됨.
 * 여기서는 store 업데이트를 포함하는 고수준 핸들러를 등록한다.
 *
 * session:new — ipcBridge에 미등록이므로 여기서 등록.
 */
import { commandBus } from '../../kernel/commandBus'
import { useSessionStore } from './store'
import { refreshSessionList } from './adapter'
import type { SessionData, SessionMeta } from './domain'

export function registerSessionCommands(): void {
  // session:new — 새 세션 생성 (ipcBridge 미등록)
  commandBus.register('session:new', async ({ cwd }) => {
    const api = window.api
    if (!api) return

    // 기존 세션 정리
    const store = useSessionStore.getState()
    store.setActiveSessionId(null)
    store.setActiveSessionData(null)

    // 목록 새로고침 (서버 사이드에서 세션이 생성될 수 있으므로)
    await refreshSessionList()
  })
}
