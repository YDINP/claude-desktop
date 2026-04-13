import type { CCSceneNode, CCSceneFile } from '../../../../../shared/ipc-schema'

export interface ViewTransformCC {
  offsetX: number
  offsetY: number
  zoom: number
}

export interface FlatNode {
  node: CCSceneNode
  worldX: number
  worldY: number
  worldRotZ: number
  worldScaleX: number
  worldScaleY: number
  depth: number
  parentUuid: string | null
  siblingIdx: number
  siblingTotal: number
  effectiveActive: boolean
}

export interface CCFileSceneViewProps {
  sceneFile: CCSceneFile
  selectedUuid: string | null
  onSelect: (uuid: string | null) => void
  onMove?: (uuid: string, x: number, y: number) => void
  onResize?: (uuid: string, w: number, h: number) => void
  onRename?: (uuid: string, name: string) => void
  onRotate?: (uuid: string, angle: number) => void
  onMultiMove?: (moves: Array<{ uuid: string; x: number; y: number }>) => void
  onMultiDelete?: (uuids: string[]) => void
  onLabelEdit?: (uuid: string, text: string) => void
  onAddNode?: (parentUuid: string | null, pos?: { x: number; y: number }) => void
  onAnchorMove?: (uuid: string, ax: number, ay: number) => void
  onMultiSelectChange?: (uuids: string[]) => void
  onDuplicate?: (uuid: string) => void
  onToggleActive?: (uuid: string) => void
  onReorder?: (uuid: string, direction: 1 | -1) => void
  pulseUuid?: string | null
  onGroupNodes?: (uuids: string[]) => void
  onOpacity?: (uuid: string, opacity: number) => void
  onReorderExtreme?: (uuid: string, to: 'first' | 'last') => void
  onAltDrag?: (uuid: string, x: number, y: number) => void
  collapsedUuids?: Set<string>
}

/** R2486: localStorage key for per-scene view state */
export function sceneViewKey(scenePath: string) {
  const sanitized = scenePath.replace(/[^a-zA-Z0-9]/g, '_')
  return 'sv-view2-' + sanitized.slice(-80)
}

export const ALIGN_SNAP_THRESHOLD = 6

export const RESOLUTION_PRESETS = [
  { label: '960\u00d7640 (CC2 \uae30\ubcf8)', w: 960, h: 640 },
  { label: '1280\u00d7720 (HD)', w: 1280, h: 720 },
  { label: '1920\u00d71080 (FHD)', w: 1920, h: 1080 },
  { label: '750\u00d71334 (iPhone SE)', w: 750, h: 1334 },
  { label: '1080\u00d71920 (\uc138\ub85c FHD)', w: 1080, h: 1920 },
  { label: '2048\u00d71536 (iPad)', w: 2048, h: 1536 },
  { label: '480\u00d7320 (\uc791\uc740 \ubaa8\ubc14\uc77c)', w: 480, h: 320 },
] as const

export const UUID_RE = /^[0-9a-f]{14,36}$/

export const VIEWPORT_CULL_MARGIN = 100

/**
 * 뷰포트 컬링: 노드가 화면 밖인지 판단하는 순수 함수
 *
 * @param svgPosX - 노드 중심의 SVG x 좌표 (ccToSvg 변환 후)
 * @param svgPosY - 노드 중심의 SVG y 좌표 (ccToSvg 변환 후)
 * @param w - 노드 width (size.x)
 * @param h - 노드 height (size.y)
 * @param anchorX - 노드 anchor x (0~1)
 * @param anchorY - 노드 anchor y (0~1)
 * @param zoom - 뷰 줌 레벨
 * @param offsetX - 뷰 오프셋 x
 * @param offsetY - 뷰 오프셋 y
 * @param vpW - 뷰포트 픽셀 폭 (SVG clientWidth)
 * @param vpH - 뷰포트 픽셀 높이 (SVG clientHeight)
 * @param margin - 컬링 여유 픽셀 (기본 VIEWPORT_CULL_MARGIN=100)
 * @returns true = 화면 안(렌더링 필요), false = 화면 밖(컬링)
 */
export function isNodeVisibleInViewport(
  svgPosX: number,
  svgPosY: number,
  w: number,
  h: number,
  anchorX: number,
  anchorY: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
  vpW: number,
  vpH: number,
  margin = VIEWPORT_CULL_MARGIN,
): boolean {
  const screenL = (svgPosX - w * anchorX) * zoom + offsetX
  const screenT = (svgPosY - h * (1 - anchorY)) * zoom + offsetY
  const screenR = screenL + w * zoom
  const screenB = screenT + h * zoom
  return !(screenR < -margin || screenL > vpW + margin || screenB < -margin || screenT > vpH + margin)
}
