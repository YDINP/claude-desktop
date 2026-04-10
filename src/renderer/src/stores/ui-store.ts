/**
 * UI Overlay Store — 모달/패널 토글 상태 중앙 관리
 *
 * App.tsx → AppLayout → 소비자 컴포넌트로 drilling되던
 * UI overlay 상태를 zustand store로 이동.
 *
 * Phase 2: CC 탭/분할, 패널탭, 사이드바 아이콘탭, 채팅 트리거 추가
 */
import { create } from 'zustand'
import type { SidebarTab } from '../components/sidebar/Sidebar'

interface UIStore {
  // Command palette
  paletteOpen: boolean
  setPaletteOpen: (v: boolean | ((prev: boolean) => boolean)) => void

  // Keyboard shortcuts overlay
  shortcutsOpen: boolean
  setShortcutsOpen: (v: boolean | ((prev: boolean) => boolean)) => void

  // Settings panel
  settingsOpen: boolean
  setSettingsOpen: (v: boolean | ((prev: boolean) => boolean)) => void

  // Image lightbox
  lightbox: { src: string; alt?: string } | null
  setLightbox: (v: { src: string; alt?: string } | null) => void

  // Pending text insert into chat input
  pendingInsert: string | undefined
  setPendingInsert: (v: string | undefined | ((prev: string | undefined) => string | undefined)) => void

  // ── Phase 2 ──────────────────────────────────────────────────────────────

  // CC tab (claude / editor) — within tab layout mode
  ccTab: 'claude' | 'editor'
  setCCTab: (v: 'claude' | 'editor' | ((prev: 'claude' | 'editor') => 'claude' | 'editor')) => void

  // CC split ratio (0.2–0.8)
  ccSplitRatio: number
  setCCSplitRatio: (v: number | ((prev: number) => number)) => void

  // Main panel tab (icon bar tabs: bookmarks, stats, etc.)
  mainPanelTab: SidebarTab | null
  setMainPanelTab: (v: SidebarTab | null | ((prev: SidebarTab | null) => SidebarTab | null)) => void

  // Active sidebar icon tab
  activeSidebarIconTab: SidebarTab | null
  setActiveSidebarIconTab: (v: SidebarTab | null | ((prev: SidebarTab | null) => SidebarTab | null)) => void

  // Chat focus trigger (increment to focus)
  chatFocusTrigger: number
  bumpChatFocusTrigger: () => void

  // Chat search trigger (increment to open search)
  chatSearchTrigger: number
  bumpChatSearchTrigger: () => void

  // Scroll-to-message target
  scrollToMessageId: string | null
  setScrollToMessageId: (v: string | null | ((prev: string | null) => string | null)) => void
}

export const useUIStore = create<UIStore>((set) => ({
  paletteOpen: false,
  setPaletteOpen: (v) =>
    set((s) => ({ paletteOpen: typeof v === 'function' ? v(s.paletteOpen) : v })),

  shortcutsOpen: false,
  setShortcutsOpen: (v) =>
    set((s) => ({ shortcutsOpen: typeof v === 'function' ? v(s.shortcutsOpen) : v })),

  settingsOpen: false,
  setSettingsOpen: (v) =>
    set((s) => ({ settingsOpen: typeof v === 'function' ? v(s.settingsOpen) : v })),

  lightbox: null,
  setLightbox: (v) => set({ lightbox: v }),

  pendingInsert: undefined,
  setPendingInsert: (v) =>
    set((s) => ({ pendingInsert: typeof v === 'function' ? v(s.pendingInsert) : v })),

  // ── Phase 2 ──────────────────────────────────────────────────────────────

  ccTab: 'claude',
  setCCTab: (v) =>
    set((s) => ({ ccTab: typeof v === 'function' ? v(s.ccTab) : v })),

  ccSplitRatio: 0.5,
  setCCSplitRatio: (v) =>
    set((s) => ({ ccSplitRatio: typeof v === 'function' ? v(s.ccSplitRatio) : v })),

  mainPanelTab: null,
  setMainPanelTab: (v) =>
    set((s) => ({ mainPanelTab: typeof v === 'function' ? v(s.mainPanelTab) : v })),

  activeSidebarIconTab: null,
  setActiveSidebarIconTab: (v) =>
    set((s) => ({ activeSidebarIconTab: typeof v === 'function' ? v(s.activeSidebarIconTab) : v })),

  chatFocusTrigger: 0,
  bumpChatFocusTrigger: () => set((s) => ({ chatFocusTrigger: s.chatFocusTrigger + 1 })),

  chatSearchTrigger: 0,
  bumpChatSearchTrigger: () => set((s) => ({ chatSearchTrigger: s.chatSearchTrigger + 1 })),

  scrollToMessageId: null,
  setScrollToMessageId: (v) =>
    set((s) => ({ scrollToMessageId: typeof v === 'function' ? v(s.scrollToMessageId) : v })),
}))
