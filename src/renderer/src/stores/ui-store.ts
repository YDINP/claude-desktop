/**
 * UI Overlay Store — 모달/패널 토글 상태 중앙 관리
 *
 * App.tsx → AppLayout → 소비자 컴포넌트로 drilling되던
 * UI overlay 상태를 zustand store로 이동.
 */
import { create } from 'zustand'

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
}))
