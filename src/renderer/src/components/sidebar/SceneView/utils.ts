import type { CCNode } from '../../../../../shared/ipc-schema'
import type { SceneNode, ViewTransform } from './types'

export function flattenTree(
  node: CCNode,
  parentUuid: string | null,
  out: Map<string, SceneNode>,
  parentWorldX = 0,
  parentWorldY = 0
): void {
  const worldX = parentWorldX + node.position.x
  const worldY = parentWorldY + node.position.y
  const sn: SceneNode = {
    uuid: node.uuid,
    name: node.name,
    active: node.active,
    x: node.position.x,
    y: node.position.y,
    worldX,
    worldY,
    width: node.size.width,
    height: node.size.height,
    anchorX: node.anchor.x,
    anchorY: node.anchor.y,
    scaleX: node.scale.x,
    scaleY: node.scale.y,
    rotation: node.rotation,
    opacity: node.opacity,
    color: node.color,
    parentUuid,
    childUuids: node.children.map(c => c.uuid),
    components: node.components,
  }
  out.set(node.uuid, sn)
  for (const child of node.children) {
    flattenTree(child, node.uuid, out, worldX, worldY)
  }
}

export function getRenderOrder(
  rootUuid: string,
  nodeMap: Map<string, SceneNode>
): string[] {
  const result: string[] = []
  function dfs(uuid: string) {
    result.push(uuid)
    const node = nodeMap.get(uuid)
    if (!node) return
    for (const childUuid of node.childUuids) dfs(childUuid)
  }
  dfs(rootUuid)
  return result
}

// 씬 크기가 designWidth x designHeight 일 때
// Cocos (cx, cy) → SVG (sx, sy)
export function cocosToSvg(
  cx: number,
  cy: number,
  designWidth: number,
  designHeight: number
): { sx: number; sy: number } {
  return {
    sx: designWidth / 2 + cx,
    sy: designHeight / 2 - cy,
  }
}

// SVG 마우스 좌표 → 씬 좌표 (ViewTransform 적용)
export function svgToCocos(
  svgX: number,
  svgY: number,
  view: ViewTransform,
  designWidth: number,
  designHeight: number
): { cx: number; cy: number } {
  const sceneX = (svgX - view.offsetX) / view.zoom
  const sceneY = (svgY - view.offsetY) / view.zoom
  return {
    cx: sceneX - designWidth / 2,
    cy: -(sceneY - designHeight / 2),
  }
}

export function getComponentIcon(components: { type: string }[]): string {
  const types = components.map(c => c.type)
  if (types.some(t => t.includes('Button'))) return 'B'
  if (types.some(t => t.includes('Label') || t.includes('RichText'))) return 'T'
  if (types.some(t => t.includes('Sprite'))) return 'S'
  if (types.some(t => t.includes('Layout'))) return 'L'
  if (types.some(t => t.includes('ScrollView'))) return 'V'
  if (types.some(t => t.includes('EditBox'))) return 'E'
  if (types.some(t => t.includes('ProgressBar'))) return 'P'
  if (types.some(t => t.includes('Toggle'))) return 'G'
  if (types.some(t => t.includes('Camera'))) return 'C'
  return ''
}
