import { createContext, useContext } from 'react'
import type { SceneNode, ViewTransform, UndoEntry, ClipboardEntry } from './types'
import type { Annotation, SnapshotEntry, NodeSnapshot, EditHistoryEntry, ViewportPreset, NodeTemplate, CameraBookmark } from './sceneViewConstants'
import type { SceneBgValue } from './SceneToolbar'

// SceneViewPanel의 공유 상태를 하위 컴포넌트에 전달하는 Context
export interface SceneViewContextValue {
  // ── 씬 데이터 ──
  nodeMap: Map<string, SceneNode>
  rootUuid: string | null
  updateNode: (uuid: string, partial: Partial<SceneNode>) => void
  refresh: () => Promise<void>

  // ── 뷰 상태 ──
  view: ViewTransform
  setView: React.Dispatch<React.SetStateAction<ViewTransform>>
  DESIGN_W: number
  DESIGN_H: number

  // ── 선택 ──
  selectedUuid: string | null
  setSelectedUuid: (uuid: string | null) => void
  selectedUuids: Set<string>
  setSelectedUuids: React.Dispatch<React.SetStateAction<Set<string>>>
  selectedNode: SceneNode | null

  // ── 노드 관련 맵/세트 ──
  bookmarkedUuids: Set<string>
  setBookmarkedUuids: React.Dispatch<React.SetStateAction<Set<string>>>
  pinnedUuids: Set<string>
  lockedUuids: Set<string>
  setLockedUuids: React.Dispatch<React.SetStateAction<Set<string>>>
  hiddenLayers: Set<string>
  setHiddenLayers: React.Dispatch<React.SetStateAction<Set<string>>>
  lockedLayers: Set<string>
  setLockedLayers: React.Dispatch<React.SetStateAction<Set<string>>>
  collapsedUuids: Set<string>
  setCollapsedUuids: React.Dispatch<React.SetStateAction<Set<string>>>
  nodeColors: Record<string, string>
  setNodeColors: React.Dispatch<React.SetStateAction<Record<string, string>>>
  nodeColorTags: Record<string, string>
  setNodeColorTags: React.Dispatch<React.SetStateAction<Record<string, string>>>
  nodeTags: Record<string, string[]>
  setNodeTags: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  layerColors: Record<string, string>
  setLayerColors: React.Dispatch<React.SetStateAction<Record<string, string>>>

  // ── 조작/액션 ──
  handleDeleteNode: () => void
  handleCopy: () => void
  handlePaste: () => void
  handleDuplicate: () => void
  togglePin: (uuid: string) => void

  // ── undo/clipboard ──
  clipboard: ClipboardEntry[]
  setClipboard: React.Dispatch<React.SetStateAction<ClipboardEntry[]>>
  setCopiedNode: React.Dispatch<React.SetStateAction<SceneNode | null>>

  // ── 오버레이/패널 상태 ──
  topLevelNodes: SceneNode[]
  nodeToTopLevel: Map<string, string>
  collectDescendants: (uuid: string) => string[]
  allLayers: string[]

  // ── 기타 상태 ──
  connected: boolean
  port: number
  containerRef: React.RefObject<HTMLDivElement>

  // ── Diff/Snapshot ──
  savedSnapshot: Map<string, NodeSnapshot>
  changedUuids: Set<string>
  diffModeR1381: boolean
  setDiffModeR1381: React.Dispatch<React.SetStateAction<boolean>>
  beforeAfterMode: boolean
  setBeforeAfterMode: React.Dispatch<React.SetStateAction<boolean>>
  sliderX: number
  setSliderX: React.Dispatch<React.SetStateAction<number>>
  snapshot: Map<string, SnapshotEntry> | null
  showDiff: boolean
  setShowDiff: React.Dispatch<React.SetStateAction<boolean>>

  // ── Edit History ──
  editHistory: EditHistoryEntry[]
  showEditHistory: boolean
  setShowEditHistory: React.Dispatch<React.SetStateAction<boolean>>

  // ── JSON Viewer ──
  showJsonViewer: boolean
  setShowJsonViewer: React.Dispatch<React.SetStateAction<boolean>>
  jsonViewScope: 'selected' | 'full'
  setJsonViewScope: React.Dispatch<React.SetStateAction<'selected' | 'full'>>

  // ── Share ──
  shareUrl: string | null
  setShareUrl: React.Dispatch<React.SetStateAction<string | null>>
  shareLoading: boolean
  setShareLoading: React.Dispatch<React.SetStateAction<boolean>>

  // ── Import ──
  showImportModal: boolean
  setShowImportModal: React.Dispatch<React.SetStateAction<boolean>>
  importJson: string
  setImportJson: React.Dispatch<React.SetStateAction<string>>
  importError: string | null
  setImportError: React.Dispatch<React.SetStateAction<string | null>>

  // ── Center Guide / Snap ──
  showCenterGuide: boolean
  setShowCenterGuide: React.Dispatch<React.SetStateAction<boolean>>
  snapThreshold: number
  setSnapThreshold: React.Dispatch<React.SetStateAction<number>>
  blockInactiveClick: boolean
  setBlockInactiveClick: React.Dispatch<React.SetStateAction<boolean>>

  // ── Snapshot records ──
  snapshots: Array<{ label: string; timestamp: number; nodes: unknown[] }>
  snapshotOpen: boolean
  setSnapshotOpen: React.Dispatch<React.SetStateAction<boolean>>
  takeSnapshot: () => void
  handleTakeSnapshot: () => void

  // ── Node access/click heatmap ──
  nodeAccessCount: Record<string, number>
  setNodeAccessCount: React.Dispatch<React.SetStateAction<Record<string, number>>>

  // ── Layer Panel ──
  showLayerPanel: boolean
  showAllToggle: boolean
  setShowAllToggle: React.Dispatch<React.SetStateAction<boolean>>
  layerDragIdx: number | null
  setLayerDragIdx: React.Dispatch<React.SetStateAction<number | null>>
  layerDropIdx: number | null
  setLayerDropIdx: React.Dispatch<React.SetStateAction<number | null>>

  // ── Anim preview ──
  animPlayingUuid: string | null
  handleAnimPreviewStart: (uuid: string, durationMs: number) => void
  handleAnimPreviewStop: () => void
  handleAiAnalyze: (uuid: string) => void

  // ── Node Templates ──
  nodeTemplates: NodeTemplate[]
  setNodeTemplates: React.Dispatch<React.SetStateAction<NodeTemplate[]>>
  showTemplateDropdown: boolean
  setShowTemplateDropdown: React.Dispatch<React.SetStateAction<boolean>>

  // ── Context menu helpers ──
  svgContextMenu: { uuid: string | null; x: number; y: number } | null
  setSvgContextMenu: React.Dispatch<React.SetStateAction<{ uuid: string | null; x: number; y: number } | null>>

  // ── Color tag picker ──
  showColorTagPicker: { uuid: string; x: number; y: number } | null
  setShowColorTagPicker: React.Dispatch<React.SetStateAction<{ uuid: string; x: number; y: number } | null>>

  // ── Tag input modal ──
  nodeTagInput: string | null
  setNodeTagInput: React.Dispatch<React.SetStateAction<string | null>>
  nodeTagDraft: string
  setNodeTagDraft: React.Dispatch<React.SetStateAction<string>>

  // ── Scene tabs ──
  sceneTabFiles: string[]
  sceneHistory: string[]

  // ── Minimap ──
  showMinimap: boolean
  setShowMinimap: React.Dispatch<React.SetStateAction<boolean>>

  // ── Flash ──
  flashUuid: string | null
  setFlashUuid: React.Dispatch<React.SetStateAction<string | null>>
  flashTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>

  // ── SVG ref ──
  svgRef: React.RefObject<SVGSVGElement>

  // ── Change history ──
  changeHistory: Array<{ uuid: string; name: string; x: number; y: number; ts: number }>
  showChangeHistory: boolean
  setShowChangeHistory: React.Dispatch<React.SetStateAction<boolean>>

  // ── Before/After drag ref ──
  beforeAfterDragRef: React.MutableRefObject<boolean>

  // ── Compare ──
  compareScenePath: string | null
  setCompareScenePath: React.Dispatch<React.SetStateAction<string | null>>
}

const SceneViewContext = createContext<SceneViewContextValue | null>(null)

export function SceneViewProvider({ value, children }: { value: SceneViewContextValue; children: React.ReactNode }) {
  return <SceneViewContext.Provider value={value}>{children}</SceneViewContext.Provider>
}

export function useSceneViewCtx(): SceneViewContextValue {
  const ctx = useContext(SceneViewContext)
  if (!ctx) throw new Error('useSceneViewCtx must be used within SceneViewProvider')
  return ctx
}
