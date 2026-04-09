import { createContext, useContext } from 'react'
import type { CCSceneFile, CCVec3 } from '../../../../../shared/ipc-schema'
import type { FlatNode, CCFileSceneViewProps, ViewTransformCC } from './ccSceneTypes'
import type { CCSceneOverlayState } from './useCCSceneOverlayState'

// CCFileSceneView의 공유 상태를 하위 컴포넌트에 전달하는 Context
export interface CCSceneContextValue {
  // ── props (부모 전달) ──
  sceneFile: CCSceneFile
  selectedUuid: string | null
  onSelect: CCFileSceneViewProps['onSelect']
  onMove: CCFileSceneViewProps['onMove']
  onResize: CCFileSceneViewProps['onResize']
  onRename: CCFileSceneViewProps['onRename']
  onRotate: CCFileSceneViewProps['onRotate']
  onMultiMove: CCFileSceneViewProps['onMultiMove']
  onMultiDelete: CCFileSceneViewProps['onMultiDelete']
  onLabelEdit: CCFileSceneViewProps['onLabelEdit']
  onAddNode: CCFileSceneViewProps['onAddNode']
  onAnchorMove: CCFileSceneViewProps['onAnchorMove']
  onMultiSelectChange: CCFileSceneViewProps['onMultiSelectChange']
  onDuplicate: CCFileSceneViewProps['onDuplicate']
  onToggleActive: CCFileSceneViewProps['onToggleActive']
  onReorder: CCFileSceneViewProps['onReorder']
  onGroupNodes: CCFileSceneViewProps['onGroupNodes']
  onOpacity: CCFileSceneViewProps['onOpacity']
  onReorderExtreme: CCFileSceneViewProps['onReorderExtreme']
  onAltDrag: CCFileSceneViewProps['onAltDrag']
  pulseUuid: CCFileSceneViewProps['pulseUuid']

  // ── 뷰 상태 ──
  view: ViewTransformCC
  setView: React.Dispatch<React.SetStateAction<ViewTransformCC>>
  viewRef: React.MutableRefObject<ViewTransformCC>
  svgRef: React.RefObject<SVGSVGElement>

  // ── 씬 데이터 ──
  flatNodes: FlatNode[]
  nodeMap: Map<string, FlatNode>
  designW: number
  designH: number
  effectiveW: number
  effectiveH: number
  bgColor: string
  cx: number
  cy: number
  ccToSvg: (ccX: number, ccY: number) => { x: number; y: number }
  cameraFrames: Array<{ worldX: number; worldY: number; w: number; h: number }>

  // ── 다중 선택 ──
  multiSelected: Set<string>
  setMultiSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  uuids: string[]

  // ── 드래그/리사이즈/회전 오버라이드 ──
  dragOverride: { uuid: string; x: number; y: number } | null
  resizeOverride: { uuid: string; w: number; h: number; dx?: number; dy?: number } | null
  rotateOverride: { uuid: string; angle: number } | null
  anchorOverride: { uuid: string; ax: number; ay: number } | null
  multiDragDelta: { dx: number; dy: number } | null
  dragGhost: { uuid: string; worldX: number; worldY: number; w: number; h: number; anchorX: number; anchorY: number } | null
  selectionBox: { x1: number; y1: number; x2: number; y2: number } | null
  alignGuides: Array<{ type: 'V' | 'H'; pos: number; label?: string }>
  snapIndicator: { x: number; y: number } | null

  // ── 도구 상태 ──
  transformTool: 'move' | 'rotate' | 'scale'
  setTransformTool: React.Dispatch<React.SetStateAction<'move' | 'rotate' | 'scale'>>
  transformToolRef: React.MutableRefObject<'move' | 'rotate' | 'scale'>
  isPanning: boolean
  measureMode: boolean
  setMeasureMode: React.Dispatch<React.SetStateAction<boolean>>
  measureLine: { svgX1: number; svgY1: number; svgX2: number; svgY2: number } | null
  setMeasureLine: React.Dispatch<React.SetStateAction<{ svgX1: number; svgY1: number; svgX2: number; svgY2: number } | null>>
  measureStartRef: React.MutableRefObject<{ svgX: number; svgY: number } | null>

  // ── 노드 상태 ──
  lockedUuids: Set<string>
  setLockedUuids: React.Dispatch<React.SetStateAction<Set<string>>>
  toggleLock: (uuid: string) => void
  hiddenUuids: Set<string>
  setHiddenUuids: React.Dispatch<React.SetStateAction<Set<string>>>
  editingUuid: string | null
  setEditingUuid: React.Dispatch<React.SetStateAction<string | null>>
  editInputRef: React.MutableRefObject<HTMLInputElement | null>
  editingLabelUuid: string | null
  setEditingLabelUuid: React.Dispatch<React.SetStateAction<string | null>>
  editLabelRef: React.MutableRefObject<HTMLInputElement | null>

  // ── 마우스 상태 ──
  mouseScenePos: { x: number; y: number } | null
  hoverUuid: string | null
  setHoverUuid: React.Dispatch<React.SetStateAction<string | null>>
  hoverClientPos: { x: number; y: number } | null
  setHoverClientPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
  hoverClientPosRef: React.MutableRefObject<{ x: number; y: number } | null>

  // ── 검색 ──
  svSearch: string
  setSvSearch: React.Dispatch<React.SetStateAction<string>>
  svSearchMatches: Set<string>
  svSearchMatchIdxRef: React.MutableRefObject<number>

  // ── 오버레이 상태 (useCCSceneOverlayState) ──
  ov: CCSceneOverlayState

  // ── 핀 마커 ──
  pinMarkers: { id: number; ccX: number; ccY: number; label?: string }[]
  setPinMarkers: React.Dispatch<React.SetStateAction<{ id: number; ccX: number; ccY: number; label?: string }[]>>
  showPinPanel: boolean
  setShowPinPanel: React.Dispatch<React.SetStateAction<boolean>>

  // ── 뷰 북마크 ──
  viewBookmarks: (ViewTransformCC | null)[]
  setViewBookmarks: React.Dispatch<React.SetStateAction<(ViewTransformCC | null)[]>>

  // ── 스크린샷 ──
  screenshotSending: boolean
  handleScreenshotAI: (e?: React.MouseEvent) => void
  handleSvgExport: () => void

  // ── Fit/Pan 액션 ──
  handleFit: () => void
  handleFitToSelected: () => void
  panToCenter: () => void

  // ── 레퍼런스 이미지 ──
  refImgSrc: string | null
  setRefImgSrc: React.Dispatch<React.SetStateAction<string | null>>
  refImgOpacity: number
  setRefImgOpacity: React.Dispatch<React.SetStateAction<number>>
  refImgInputRef: React.MutableRefObject<HTMLInputElement | null>

  // ── 줌 편집 ──
  editingZoom: boolean
  setEditingZoom: React.Dispatch<React.SetStateAction<boolean>>

  // ── 컨텍스트 메뉴 ──
  ctxMenu: { x: number; y: number; uuid: string | null } | null
  setCtxMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; uuid: string | null } | null>>
  nodePickMenu: { x: number; y: number; nodes: Array<{ uuid: string; name: string }> } | null
  setNodePickMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; nodes: Array<{ uuid: string; name: string }> } | null>>
  nodePickMenuRef: React.RefObject<HTMLDivElement>

  // ── 선택 히스토리 ──
  selHistoryRef: React.MutableRefObject<string[]>
  selHistoryIdxRef: React.MutableRefObject<number>
  histPopupOpen: boolean
  setHistPopupOpen: React.Dispatch<React.SetStateAction<boolean>>
  histPopupBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  navSkipRef: React.MutableRefObject<boolean>

  // ── 패널 상태 ──
  showShortcutOverlay: boolean
  setShowShortcutOverlay: React.Dispatch<React.SetStateAction<boolean>>
  overlayPanelRef: React.RefObject<HTMLSpanElement>
  toolPanelRef: React.RefObject<HTMLSpanElement>

  // ── 가이드라인 ──
  userGuides: Array<{ type: 'V' | 'H'; pos: number }>
  setUserGuides: React.Dispatch<React.SetStateAction<Array<{ type: 'V' | 'H'; pos: number }>>>
  addUserGuide: (type: 'V' | 'H') => void
  clearUserGuides: () => void

  // ── 해상도 커스텀 ──
  resCustomWRef: React.MutableRefObject<HTMLInputElement | null>
  resCustomHRef: React.MutableRefObject<HTMLInputElement | null>

  // ── 드래그 참조 ──
  dragRef: React.MutableRefObject<{ uuid: string; startMouseX: number; startMouseY: number; startNodeX: number; startNodeY: number; isAltDrag?: boolean } | null>
  resizeRef: React.MutableRefObject<{ uuid: string; startMouseX: number; startMouseY: number; startW: number; startH: number; dir: 'SE' | 'S' | 'E' | 'NW' | 'N' | 'NE' | 'W' | 'SW'; startLocalX: number; startLocalY: number } | null>
  rotateRef: React.MutableRefObject<{ uuid: string; centerX: number; centerY: number; startAngle: number; startRotation: number } | null>
  anchorRef: React.MutableRefObject<{ uuid: string; rectX: number; rectY: number; w: number; h: number } | null>
  guideDragRef: React.MutableRefObject<{ idx: number; type: 'V' | 'H'; startMouse: number; startPos: number } | null>
  selBoxRef: React.MutableRefObject<{ startSvgX: number; startSvgY: number } | null>
  multiSelectedRef: React.MutableRefObject<Set<string>>
  multiDragRef: React.MutableRefObject<{ startMouseX: number; startMouseY: number; nodes: Map<string, { localX: number; localY: number }> } | null>
  flatNodesRef: React.MutableRefObject<FlatNode[]>
  effectiveWRef: React.MutableRefObject<number>
  effectiveHRef: React.MutableRefObject<number>
  ccToSvgRef: React.MutableRefObject<(ccX: number, ccY: number) => { x: number; y: number }>
  lastClickCycleRef: React.MutableRefObject<{ svgX: number; svgY: number; uuidList: string[]; idx: number } | null>
  isSpaceDownRef: React.MutableRefObject<boolean>

  // ── 스프라이트/폰트 캐시 ──
  spriteCacheRef: React.MutableRefObject<Map<string, { dataUrl: string; w: number; h: number; bL?: number; bT?: number; bR?: number; bB?: number }>>
  fontCacheRef: React.MutableRefObject<Map<string, { dataUrl?: string; familyName: string }>>
  fontCacheVer: number

  // ── 파생 데이터 ──
  refUuids: string[]
  parentUuidSet: Set<string>
  maxDepthVal: number
  maxNodeArea: number
  viewLock: boolean

  // ── 마우스 핸들러 ──
  handleMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void
  handleMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void
  handleMouseUp: () => void
  setMouseScenePos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>

  // ── 미니맵 위치 ──
  mmPos: { x: number; y: number } | null
  setMmPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>

  // ── 드래그 오버라이드 setter ──
  setDragOverride: React.Dispatch<React.SetStateAction<{ uuid: string; x: number; y: number } | null>>
  setDragGhost: React.Dispatch<React.SetStateAction<{ uuid: string; worldX: number; worldY: number; w: number; h: number; anchorX: number; anchorY: number } | null>>
  setResizeOverride: React.Dispatch<React.SetStateAction<{ uuid: string; w: number; h: number; dx?: number; dy?: number } | null>>
  setRotateOverride: React.Dispatch<React.SetStateAction<{ uuid: string; angle: number } | null>>
  setAnchorOverride: React.Dispatch<React.SetStateAction<{ uuid: string; ax: number; ay: number } | null>>
  setMultiDragDelta: React.Dispatch<React.SetStateAction<{ dx: number; dy: number } | null>>
  setSelectionBox: React.Dispatch<React.SetStateAction<{ x1: number; y1: number; x2: number; y2: number } | null>>
  setAlignGuides: React.Dispatch<React.SetStateAction<Array<{ type: 'V' | 'H'; pos: number; label?: string }>>>
  setSnapIndicator: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
}

const CCSceneContext = createContext<CCSceneContextValue | null>(null)

export function CCSceneProvider({ value, children }: { value: CCSceneContextValue; children: React.ReactNode }) {
  return <CCSceneContext.Provider value={value}>{children}</CCSceneContext.Provider>
}

export function useCCSceneCtx(): CCSceneContextValue {
  const ctx = useContext(CCSceneContext)
  if (!ctx) throw new Error('useCCSceneCtx must be used within CCSceneProvider')
  return ctx
}
