export interface Vec2 { x: number; y: number }
export interface Size { w: number; h: number }

export interface SceneNode {
  uuid: string
  name: string
  active: boolean

  // 로컬 변환 (CC 좌표계: Y-up, 앵커 기준)
  position: Vec2      // 부모 기준 로컬 position
  size: Size          // width, height
  anchor: Vec2        // 0~1 범위 (default: 0.5, 0.5)
  scale: Vec2         // (default: 1, 1)
  rotation: number    // CCW degrees

  // 시각 속성
  opacity: number     // 0~255
  color: string       // "#rrggbb"

  // 컴포넌트 목록 (className 문자열)
  components: string[]

  // 트리 관계
  parentUuid: string | null
  childUuids: string[]

  // 내부 캐시 (Track B에서 계산, 외부 mutate 금지)
  _dirty: boolean           // API 응답과 diff가 있으면 true
  _worldPos: Vec2           // 루트 기준 월드 position (계산값)
  _worldRot: number         // 누적 회전
  _worldScaleX: number      // 누적 스케일 X
  _worldScaleY: number      // 누적 스케일 Y
}

export interface ViewTransform {
  offsetX: number   // 뷰포트 중심 기준 pan (px)
  offsetY: number
  zoom: number      // 1.0 = 100%
}

export type DragKind = 'move' | 'resize'

export type ResizeHandle =
  | 'nw' | 'n' | 'ne'
  | 'w'            | 'e'
  | 'sw' | 's' | 'se'

export interface DragState {
  kind: DragKind
  uuid: string
  handle?: ResizeHandle      // resize 시에만

  // 드래그 시작 시점 스냅샷
  startScreenX: number
  startScreenY: number
  startNodeX: number         // CC 좌표 기준
  startNodeY: number
  startWidth: number
  startHeight: number
}

export interface CanvasInfo {
  width: number
  height: number
  fitWidth: boolean
  fitHeight: boolean
}

export interface SceneState {
  nodes: Record<string, SceneNode>  // uuid → node
  rootUuids: string[]               // 루트 노드 uuid 목록 (순서 보장)
  selectedUuid: string | null
  hoveredUuid: string | null
  viewTransform: ViewTransform
  drag: DragState | null
  canvas: CanvasInfo | null
  lastSyncAt: number | null         // timestamp
  syncError: string | null
}
