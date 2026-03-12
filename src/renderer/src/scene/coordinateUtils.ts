import type { Vec2, ViewTransform, SceneNode } from './sceneTypes'

/** CC 월드 좌표 → 스크린 좌표 */
export function worldToScreen(wx: number, wy: number, vt: ViewTransform): Vec2 {
  return {
    x: wx * vt.zoom + vt.offsetX,
    y: -wy * vt.zoom + vt.offsetY,
  }
}

/** 스크린 좌표 → CC 월드 좌표 */
export function screenToWorld(sx: number, sy: number, vt: ViewTransform): Vec2 {
  return {
    x: (sx - vt.offsetX) / vt.zoom,
    y: -(sy - vt.offsetY) / vt.zoom,
  }
}

/**
 * 노드의 스크린 bounding box 계산.
 * position = 앵커 기준 로컬 좌표 → 월드 좌표로 변환 후 스크린 투영.
 * 회전/스케일은 MVP에서 bounding box 수준으로만 처리(AABB).
 */
export function nodeScreenRect(
  node: SceneNode,
  vt: ViewTransform
): { x: number; y: number; w: number; h: number } {
  const wx = node._worldPos.x
  const wy = node._worldPos.y
  const sw = node.size.w * Math.abs(node._worldScaleX) * vt.zoom
  const sh = node.size.h * Math.abs(node._worldScaleY) * vt.zoom
  const center = worldToScreen(wx, wy, vt)

  return {
    x: center.x - sw * node.anchor.x,
    y: center.y - sh * (1 - node.anchor.y),  // Y-down 보정
    w: sw,
    h: sh,
  }
}

/**
 * 월드 좌표계에서 두 노드 간 relative position 계산.
 * 부모 노드의 월드 position 기준으로 자식 로컬 좌표 복원.
 */
export function worldToLocal(
  worldX: number,
  worldY: number,
  parentWorldX: number,
  parentWorldY: number,
  parentScaleX: number,
  parentScaleY: number,
): Vec2 {
  return {
    x: (worldX - parentWorldX) / (parentScaleX || 1),
    y: (worldY - parentWorldY) / (parentScaleY || 1),
  }
}

/** designResolution 중심을 (0,0)으로 할 때의 뷰포트 기본 offsetX/Y 계산 */
export function defaultViewTransform(
  canvasW: number,
  canvasH: number,
  viewportW: number,
  viewportH: number,
  initialZoom = 1,
): ViewTransform {
  return {
    offsetX: viewportW / 2,
    offsetY: viewportH / 2,
    zoom: initialZoom,
  }
}
