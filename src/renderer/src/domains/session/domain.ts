/**
 * Session 도메인 순수 타입
 * 외부 의존 없음 — sessionUtils.ts의 SessionMeta를 정규화
 */

export interface SessionMeta {
  id: string
  title: string
  cwd: string
  model: string
  updatedAt: number
  createdAt: number
  messageCount: number
  pinned?: boolean
  tags?: string[]
  locked?: boolean
  collection?: string
  forkedFrom?: string
}

export interface SessionData {
  id: string
  title: string
  cwd: string
  model: string
  messages: unknown[]
  createdAt: number
  updatedAt: number
  pinned?: boolean
  tags?: string[]
  locked?: boolean
  collection?: string
  forkedFrom?: string
  note?: string
  systemPrompt?: string
}

export interface SessionStats {
  totalMessages?: number
  userMessages?: number
  assistantMessages?: number
  estimatedTokens?: number
  createdAt?: string | null
  updatedAt?: string | null
}

export interface SessionSearchResult {
  sessionId: string
  sessionTitle: string
  messageIndex: number
  role: string
  excerpt: string
  updatedAt: number
}

export interface TemplateMeta {
  id: string
  name: string
  description?: string
  createdAt: number
  messageCount: number
}
