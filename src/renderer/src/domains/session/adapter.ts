/**
 * Session Adapter — IPC 호출 → Session Store 업데이트
 *
 * session은 claude:message처럼 실시간 스트리밍 이벤트가 아니라
 * request-response 패턴(ipcRenderer.invoke)이므로,
 * 어댑터는 초기 목록 로드와 세션 로드/삭제 시 store 동기화를 담당.
 *
 * 기존 SessionList.tsx의 로직을 점진적으로 이관하기 위한 진입점.
 */
import { useSessionStore } from './store'
import type { SessionMeta, SessionData } from './domain'

export interface SessionAdapterCallbacks {
  /** 세션 로드 완료 시 */
  onSessionLoaded?: (session: SessionData) => void
  /** 세션 삭제 완료 시 */
  onSessionDeleted?: (sessionId: string) => void
}

/**
 * Session 어댑터 초기화
 * - 세션 목록 로드
 * - 반환값: cleanup 함수 (현재는 noop)
 */
export function initSessionAdapter(callbacks?: SessionAdapterCallbacks): () => void {
  const api = window.api
  if (!api) return () => {}

  const store = () => useSessionStore.getState()

  // 초기 세션 목록 로드
  store().setLoading(true)
  api.sessionList?.()
    .then((sessions: SessionMeta[]) => {
      store().setSessions(sessions ?? [])
    })
    .catch(() => {
      store().setSessions([])
    })
    .finally(() => {
      store().setLoading(false)
    })

  return () => {
    // 현재 cleanup 없음 — session은 pull 모델이므로 이벤트 구독 불필요
  }
}

/**
 * 세션 목록 새로고침 (명시적 호출용)
 */
export async function refreshSessionList(): Promise<void> {
  const api = window.api
  if (!api?.sessionList) return

  const store = useSessionStore.getState()
  store.setLoading(true)
  try {
    const sessions = (await api.sessionList()) as SessionMeta[]
    store.setSessions(sessions ?? [])
  } catch {
    // 실패 시 기존 목록 유지
  } finally {
    store.setLoading(false)
  }
}

/**
 * 세션 로드 → store에 반영
 */
export async function loadSession(sessionId: string): Promise<SessionData | null> {
  const api = window.api
  if (!api?.sessionLoad) return null

  try {
    const data = (await api.sessionLoad(sessionId)) as SessionData | null
    if (data) {
      useSessionStore.getState().setActiveSessionId(sessionId)
      useSessionStore.getState().setActiveSessionData(data)
    }
    return data
  } catch {
    return null
  }
}

/**
 * 세션 삭제 → store에서 제거
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const api = window.api
  if (!api?.sessionDelete) return false

  try {
    const result = await api.sessionDelete(sessionId)
    if (result) {
      useSessionStore.getState().removeSession(sessionId)
    }
    return !!result
  } catch {
    return false
  }
}
