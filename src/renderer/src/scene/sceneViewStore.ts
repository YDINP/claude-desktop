import { create } from 'zustand'
import type { SceneState, SceneNode, ViewTransform, DragState, CanvasInfo } from './sceneTypes'

interface SceneActions {
  // 씬 데이터
  setNodes(nodes: Record<string, SceneNode>, rootUuids: string[]): void
  updateNode(uuid: string, patch: Partial<SceneNode>): void
  setCanvas(info: CanvasInfo): void
  setSyncError(err: string | null): void

  // 선택/호버
  selectNode(uuid: string | null): void
  hoverNode(uuid: string | null): void

  // 뷰 트랜스폼
  setViewTransform(vt: Partial<ViewTransform>): void
  resetView(canvasW: number, canvasH: number, vpW: number, vpH: number): void

  // 드래그
  beginDrag(state: DragState): void
  endDrag(): void

  // 전체 초기화 (씬 전환 시)
  reset(): void
}

const initialState: SceneState = {
  nodes: {},
  rootUuids: [],
  selectedUuid: null,
  hoveredUuid: null,
  viewTransform: { offsetX: 0, offsetY: 0, zoom: 1 },
  drag: null,
  canvas: null,
  lastSyncAt: null,
  syncError: null,
}

export const useSceneStore = create<SceneState & SceneActions>((set) => ({
  ...initialState,

  setNodes(nodes, rootUuids) {
    set({ nodes, rootUuids, lastSyncAt: Date.now(), syncError: null })
  },

  updateNode(uuid, patch) {
    set(s => ({
      nodes: { ...s.nodes, [uuid]: { ...s.nodes[uuid], ...patch } },
    }))
  },

  setCanvas(info) { set({ canvas: info }) },
  setSyncError(err) { set({ syncError: err }) },

  selectNode(uuid) { set({ selectedUuid: uuid }) },
  hoverNode(uuid) { set({ hoveredUuid: uuid }) },

  setViewTransform(vt) {
    set(s => ({ viewTransform: { ...s.viewTransform, ...vt } }))
  },

  resetView(canvasW, canvasH, vpW, vpH) {
    const zoom = Math.min(vpW / canvasW, vpH / canvasH) * 0.9
    set({
      viewTransform: {
        offsetX: vpW / 2,
        offsetY: vpH / 2,
        zoom,
      }
    })
  },

  beginDrag(state) { set({ drag: state }) },
  endDrag() { set({ drag: null }) },

  reset() { set(initialState) },
}))
