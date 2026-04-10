// SceneView 상수 & 헬퍼 함수
import type { ViewTransform, SceneNode } from './types'

// ── 로컬 타입 ──────────────────────────────────────────────
export interface Annotation { id: string; svgX: number; svgY: number; text: string }
export type SnapshotEntry = { uuid: string; x: number; y: number; width: number; height: number }
export type NodeSnapshot = { x: number; y: number; w: number; h: number; name: string; active: boolean }
export type EditHistoryEntry = { timestamp: number; action: string; nodeUuid: string; nodeName: string; before: Record<string, unknown>; after: Record<string, unknown> }
export type ViewportPreset = { name: string; zoom: number; panX: number; panY: number }
export type NodeTemplate = { name: string; node: Record<string, unknown> }
export type CameraBookmark = { zoom: number; offsetX: number; offsetY: number } | null

export interface SceneViewPanelProps {
  connected: boolean
  wsKey: string
  port?: number
}

// ── 상수 ────────────────────────────────────────────────────
export const CC_LAYER_NAMES: Record<number, string> = {
  1: 'DEFAULT', 2: 'UI_3D', 4: 'GIZMOS', 8: 'EDITOR',
  16: 'UI_2D', 32: 'SCENE_GIZMO', 64: 'PROFILER',
}

export const CANVAS_PRESETS = [
  { label: '960x640 (기본)', w: 960, h: 640 },
  { label: '1280x720 (HD)', w: 1280, h: 720 },
  { label: '1920x1080 (FHD)', w: 1920, h: 1080 },
  { label: '750x1334 (iPhone)', w: 750, h: 1334 },
  { label: '1334x750 (iPhone 가로)', w: 1334, h: 750 },
  { label: '480x320 (소형)', w: 480, h: 320 },
]

export const COLOR_TAG_PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
export const LAYER_COLOR_PALETTE = ['#4af', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee']

export const LABEL_COLORS: Record<string, string | undefined> = {
  '0': undefined,
  '1': '#f87171', '2': '#fb923c', '3': '#facc15', '4': '#4ade80',
  '5': '#34d399', '6': '#60a5fa', '7': '#a78bfa', '8': '#f472b6', '9': '#9ca3af',
}

export const VP_KEY = 'viewport-presets'
export const NT_KEY = 'node-templates'
export const VB_KEY = 'view-bookmarks'

export const DEFAULT_PRESETS: ViewportPreset[] = [
  { name: '1:1', zoom: 1, panX: 0, panY: 0 },
  { name: '2:1', zoom: 2, panX: 0, panY: 0 },
]

export const DEFAULT_TEMPLATES: NodeTemplate[] = [
  { name: '빈 노드', node: { uuid: '', name: 'EmptyNode', active: true, position: { x: 0, y: 0, z: 0 }, rotation: 0, scale: { x: 1, y: 1, z: 1 }, size: { x: 0, y: 0 }, anchor: { x: 0.5, y: 0.5 }, opacity: 255, color: { r: 255, g: 255, b: 255, a: 255 }, components: [], children: [] } },
  { name: 'UI 버튼', node: { uuid: '', name: 'Button', active: true, position: { x: 0, y: 0, z: 0 }, rotation: 0, scale: { x: 1, y: 1, z: 1 }, size: { x: 200, y: 60 }, anchor: { x: 0.5, y: 0.5 }, opacity: 255, color: { r: 255, g: 255, b: 255, a: 255 }, components: [{ type: 'cc.Button', props: { transition: 1 } }, { type: 'cc.Sprite', props: {} }], children: [] } },
]

export const PNG_BG_COLORS: Record<string, string> = { dark: '#1a1a2e', light: '#f8f8f8', transparent: 'transparent' }

// ── 헬퍼 함수 ──────────────────────────────────────────────
export function getRulerTicks(
  axis: 'h' | 'v',
  svgSize: number,
  view: { zoom: number; offsetX: number; offsetY: number }
): { pos: number; label: string | null; isMajor: boolean }[] {
  const ticks: { pos: number; label: string | null; isMajor: boolean }[] = []
  const rawStep = 50 / view.zoom
  const step = Math.pow(10, Math.round(Math.log10(rawStep)))
  const offset = axis === 'h' ? view.offsetX : view.offsetY
  const startScene = -offset / view.zoom
  const endScene = (svgSize - offset) / view.zoom
  const start = Math.floor(startScene / step) * step
  for (let s = start; s <= endScene; s += step) {
    const pos = s * view.zoom + offset
    if (pos < 0 || pos > svgSize) continue
    ticks.push({ pos, label: String(Math.round(s)), isMajor: true })
    for (let i = 1; i < 5; i++) {
      const subPos = pos + (i / 5) * step * view.zoom
      if (subPos >= 0 && subPos <= svgSize) {
        ticks.push({ pos: subPos, label: null, isMajor: false })
      }
    }
  }
  return ticks
}

export function buildHeatmap(nodes: SceneNode[], cellSize: number): Map<string, number> {
  const map = new Map<string, number>()
  for (const node of nodes) {
    const key = `${Math.floor(node.x / cellSize)},${Math.floor(node.y / cellSize)}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export function slotKey(slot: number): string {
  return `claude-desktop-scene-layout-${slot}`
}
