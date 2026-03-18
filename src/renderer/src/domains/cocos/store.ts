/**
 * Cocos 도메인 전역 zustand store
 * sceneFile / lockedUuids / pinnedUuids 등 전역 상태
 */
import { create } from 'zustand'
import type { CCSceneFile, CCSceneNode, CCStatus } from '../../../../shared/ipc-schema'

export type CCLayoutMode = 'tab' | 'split' | 'detach'

interface CocosState {
  // 연결 상태
  connected: boolean
  port: number
  status: CCStatus | null

  // CC 파일 기반 씬
  sceneFile: CCSceneFile | null
  selectedNode: CCSceneNode | null
  selectedUuids: string[]
  lockedUuids: Set<string>
  pinnedUuids: Set<string>

  // 레이아웃
  layoutMode: CCLayoutMode

  // Actions
  setConnected: (connected: boolean) => void
  setPort: (port: number) => void
  setStatus: (status: CCStatus | null) => void
  setSceneFile: (file: CCSceneFile | null) => void
  setSelectedNode: (node: CCSceneNode | null) => void
  setSelectedUuids: (uuids: string[]) => void
  setLockedUuids: (updater: ((prev: Set<string>) => Set<string>) | Set<string>) => void
  setPinnedUuids: (updater: ((prev: Set<string>) => Set<string>) | Set<string>) => void
  setLayoutMode: (mode: CCLayoutMode) => void
}

export const useCocosStore = create<CocosState>()((set, get) => ({
  connected: false,
  port: 9090,
  status: null,
  sceneFile: null,
  selectedNode: null,
  selectedUuids: [],
  lockedUuids: new Set(),
  pinnedUuids: new Set(),
  layoutMode: (localStorage.getItem('cc-layout-mode') as CCLayoutMode) ?? 'tab',

  setConnected: (connected) => set({ connected }),
  setPort: (port) => set({ port }),
  setStatus: (status) => set({ status }),
  setSceneFile: (sceneFile) => set({ sceneFile }),
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  setSelectedUuids: (selectedUuids) => set({ selectedUuids }),

  setLockedUuids: (updater) => {
    if (typeof updater === 'function') {
      set(s => ({ lockedUuids: updater(s.lockedUuids) }))
    } else {
      set({ lockedUuids: updater })
    }
  },

  setPinnedUuids: (updater) => {
    if (typeof updater === 'function') {
      set(s => ({ pinnedUuids: updater(s.pinnedUuids) }))
    } else {
      set({ pinnedUuids: updater })
    }
  },

  setLayoutMode: (layoutMode) => {
    localStorage.setItem('cc-layout-mode', layoutMode)
    set({ layoutMode })
  },
}))
