/**
 * Chat 도메인 순수 타입
 * 외부 의존 없음
 */

export interface ToolUseItem {
  id: string
  name: string
  input: unknown
  status: 'running' | 'done' | 'error'
  output?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  toolUses: ToolUseItem[]
  timestamp: number
  isError?: boolean
  bookmarked?: boolean
  pinned?: boolean
  reactions?: string[]
  note?: string
  model?: string
  editHistory?: string[]
  thinkingText?: string
  alternatives?: string[]
  altIndex?: number
}

export interface ChatSession {
  id: string
  cwd: string
  title?: string
  createdAt?: number
  updatedAt?: number
}

export interface PendingPermission {
  requestId: string
  toolName: string
  input: unknown
}
