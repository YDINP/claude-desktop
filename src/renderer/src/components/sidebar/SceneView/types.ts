// CCNode를 SceneView 내부에서 처리하기 위한 평탄화 타입
export interface SceneNode {
  uuid: string
  name: string
  active: boolean
  x: number            // position.x (로컬 좌표 — CC 편집 시 사용)
  y: number            // position.y (로컬 좌표)
  worldX?: number      // 누적 월드 좌표 (렌더링 시 사용)
  worldY?: number
  width: number        // size.width
  height: number       // size.height
  anchorX: number      // anchor.x
  anchorY: number      // anchor.y
  scaleX: number
  scaleY: number
  rotation: number     // degrees
  opacity: number
  color: { r: number; g: number; b: number; a: number }
  parentUuid: string | null
  childUuids: string[]
  components: { type: string }[]
  locked?: boolean
  memo?: string
  visible?: boolean
  tags?: string[]
  labelColor?: string
}

// SVG 뷰포트 변환
export interface ViewTransform {
  offsetX: number   // pan X (씬 원점 기준 SVG px)
  offsetY: number   // pan Y
  zoom: number      // scale factor (1 = 100%)
}

// 드래그 상태
export interface DragState {
  uuid: string
  startSvgX: number
  startSvgY: number
  startNodeX: number
  startNodeY: number
  // 그룹 드래그용: uuid → {startX, startY}
  groupOffsets?: Record<string, { startX: number; startY: number }>
}

// 리사이즈 상태
export interface ResizeState {
  uuid: string
  handle: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'
  startSvgX: number
  startSvgY: number
  startWidth: number
  startHeight: number
  startNodeX: number
  startNodeY: number
}

// 실행 취소/다시 실행 항목
export interface UndoEntry {
  type?: 'move' | 'prop'
  uuid: string
  // move
  prevX?: number
  prevY?: number
  nextX?: number
  nextY?: number
  // prop
  key?: string
  prevVal?: unknown
  nextVal?: unknown
}

// 클립보드 항목
export interface ClipboardEntry {
  uuid: string
  name: string
  x: number
  y: number
}

// 마퀴 선택 상태
export interface MarqueeState {
  startX: number
  startY: number
  endX: number
  endY: number
  active: boolean
}
