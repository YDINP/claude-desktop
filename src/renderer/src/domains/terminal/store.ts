/**
 * Terminal 전역 zustand store
 * useTerminalStore() — TerminalPanel 등에서 구독
 *
 * stores/terminal-store.ts를 대체. setActiveTabId/getState().activeTabId 사용.
 */
import { create } from 'zustand'
import type { TerminalTab } from './domain'

interface TerminalState {
  /** 열린 터미널 탭 목록 */
  tabs: TerminalTab[]
  /** 현재 활성 탭 ID */
  activeTabId: string | null
  /** 탭별 출력 히스토리 (최근 N줄만 유지) */
  outputHistory: Record<string, string[]>

  // ── Actions ──────────────────────────────────────────────────────────────

  addTab: (tab: TerminalTab) => void
  removeTab: (id: string) => void
  setActiveTabId: (id: string | null) => void
  renameTab: (id: string, title: string) => void

  /** 출력 라인 추가 (탭당 최대 1000줄 유지) */
  appendOutput: (tabId: string, data: string) => void
  clearOutput: (tabId: string) => void

  /** 전체 상태 초기화 */
  reset: () => void
}

const MAX_OUTPUT_LINES = 1000

const initialState = {
  tabs: [] as TerminalTab[],
  activeTabId: null as string | null,
  outputHistory: {} as Record<string, string[]>,
}

export const useTerminalStore = create<TerminalState>()((set) => ({
  ...initialState,

  addTab: (tab) => set((s) => ({
    tabs: [...s.tabs, tab],
    activeTabId: tab.id,
  })),

  removeTab: (id) => set((s) => {
    const remaining = s.tabs.filter((t) => t.id !== id)
    const { [id]: _, ...rest } = s.outputHistory
    return {
      tabs: remaining,
      activeTabId: s.activeTabId === id
        ? (remaining[remaining.length - 1]?.id ?? null)
        : s.activeTabId,
      outputHistory: rest,
    }
  }),

  setActiveTabId: (id) => set({ activeTabId: id }),

  renameTab: (id, title) => set((s) => ({
    tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
  })),

  appendOutput: (tabId, data) => set((s) => {
    const existing = s.outputHistory[tabId] ?? []
    const lines = [...existing, data]
    return {
      outputHistory: {
        ...s.outputHistory,
        [tabId]: lines.length > MAX_OUTPUT_LINES
          ? lines.slice(lines.length - MAX_OUTPUT_LINES)
          : lines,
      },
    }
  }),

  clearOutput: (tabId) => set((s) => ({
    outputHistory: { ...s.outputHistory, [tabId]: [] },
  })),

  reset: () => set(initialState),
}))

/** ChatPanel 등에서 비반응형으로 현재 활성 탭 ID를 읽을 때 사용 */
export function getActiveTerminalId(): string | null {
  return useTerminalStore.getState().activeTabId
}

/** TerminalPanel 등에서 비반응형으로 활성 탭 ID를 설정할 때 사용 */
export function setActiveTerminalId(id: string | null): void {
  useTerminalStore.getState().setActiveTabId(id)
}
