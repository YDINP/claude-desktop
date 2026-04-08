/**
 * Session 전역 zustand store
 * useSessionStore() — SessionList, App 등에서 구독
 *
 * 기존 stores/project-store.ts, sidebar/SessionList.tsx의 세션 상태를
 * 점진적으로 이관하기 위한 canonical store.
 * 현재는 도메인 파일만 생성 — 기존 코드는 그대로 유지.
 */
import { create } from 'zustand'
import type { SessionMeta, SessionData, SessionStats } from './domain'

interface SessionState {
  /** 세션 메타 목록 (사이드바 표시용) */
  sessions: SessionMeta[]
  /** 현재 활성 세션 ID */
  activeSessionId: string | null
  /** 현재 로드된 세션 전체 데이터 */
  activeSessionData: SessionData | null
  /** 목록 로딩 중 */
  loading: boolean
  /** 세션별 통계 캐시 */
  statsCache: Record<string, SessionStats>

  // ── Actions ──────────────────────────────────────────────────────────────

  setSessions: (sessions: SessionMeta[]) => void
  setActiveSessionId: (id: string | null) => void
  setActiveSessionData: (data: SessionData | null) => void
  setLoading: (loading: boolean) => void

  /** 세션 목록에서 특정 세션 메타 업데이트 */
  updateSessionMeta: (id: string, patch: Partial<SessionMeta>) => void
  /** 세션 목록에서 특정 세션 제거 */
  removeSession: (id: string) => void
  /** 세션 목록 앞에 추가 */
  prependSession: (meta: SessionMeta) => void
  /** 통계 캐시 업데이트 */
  setStats: (id: string, stats: SessionStats) => void
  /** 전체 상태 초기화 */
  reset: () => void
}

const initialState = {
  sessions: [] as SessionMeta[],
  activeSessionId: null as string | null,
  activeSessionData: null as SessionData | null,
  loading: false,
  statsCache: {} as Record<string, SessionStats>,
}

export const useSessionStore = create<SessionState>()((set) => ({
  ...initialState,

  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setActiveSessionData: (data) => set({ activeSessionData: data }),
  setLoading: (loading) => set({ loading }),

  updateSessionMeta: (id, patch) => set((s) => ({
    sessions: s.sessions.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  })),

  removeSession: (id) => set((s) => ({
    sessions: s.sessions.filter((m) => m.id !== id),
    activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    activeSessionData: s.activeSessionData?.id === id ? null : s.activeSessionData,
  })),

  prependSession: (meta) => set((s) => ({
    sessions: [meta, ...s.sessions],
  })),

  setStats: (id, stats) => set((s) => ({
    statsCache: { ...s.statsCache, [id]: stats },
  })),

  reset: () => set(initialState),
}))
