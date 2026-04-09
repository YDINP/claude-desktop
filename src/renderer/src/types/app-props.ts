/**
 * AppLayout prop용 슬림 타입 — 순환 import 방지를 위해 별도 파일로 분리.
 * project: ReturnType<typeof useProject>, chat: ReturnType<typeof useChatStore>
 * 전체 인터페이스 대신 AppLayout이 실제로 접근하는 필드만 선언.
 */
import type { ChatMessage } from '../domains/chat/domain'

/** useProject() 반환 중 AppLayout이 사용하는 필드 */
export interface ProjectContext {
  currentPath: string | null
  selectedModel: string
  totalCost: number
}

/** useChatStore() 반환 중 AppLayout이 사용하는 필드 */
export interface ChatContext {
  messages: ChatMessage[]
  isStreaming: boolean
  sessionId: string | null
  sessionInputTokens: number
  sessionOutputTokens: number
  finishStreaming: () => void
  hydrate: (msgs: ChatMessage[], sessionId: string | null) => void
  clearMessages: () => void
  setSessionId: (id: string | null) => void
}
