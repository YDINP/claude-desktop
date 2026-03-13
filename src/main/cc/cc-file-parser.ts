import fs from 'fs'
import type {
  CCSceneNode, CCSceneComponent, CCSceneFile,
  CCVec2, CCVec3, CCColor, CCFileProjectInfo,
} from '../../shared/ipc-schema'

type RawEntry = Record<string, unknown>

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * CC 2.x .fire / CC 3.x .scene 파일 파싱 → CCSceneFile
 * - flat JSON 배열 → CCSceneNode 트리로 변환
 * - 파일 확장자(.fire/.scene) 또는 내부 필드(_trs/_lpos)로 버전 자동 감지
 */
export function parseCCScene(scenePath: string, projectInfo: CCFileProjectInfo): CCSceneFile {
  const raw = JSON.parse(fs.readFileSync(scenePath, 'utf-8')) as RawEntry[]
  const version = projectInfo.version ?? detectVersionFromRaw(raw)

  // SceneAsset(index 0) → scene ref → cc.Scene entry
  const sceneAssetEntry = raw.find(
    e => e.__type__ === 'cc.SceneAsset' || e.__type__ === 'cc.SceneGraphAsset'
  )
  const sceneRef = (sceneAssetEntry as RawEntry | undefined)?.scene
  const sceneIdx =
    sceneRef != null && typeof (sceneRef as RawEntry).__id__ === 'number'
      ? (sceneRef as RawEntry).__id__ as number
      : raw.findIndex(e => e.__type__ === 'cc.Scene')

  if (sceneIdx < 0) throw new Error(`씬 루트 노드를 찾을 수 없습니다: ${scenePath}`)

  const root =
    version === '2x'
      ? parseNode2x(raw, sceneIdx)
      : parseNode3x(raw, sceneIdx, buildUiTransformMap(raw))

  return { projectInfo, scenePath, root, _raw: raw }
}

// ── Version Detection ─────────────────────────────────────────────────────────

function detectVersionFromRaw(raw: RawEntry[]): '2x' | '3x' {
  for (const e of raw) {
    if (e.__type__ === 'cc.Node') {
      if ('_trs' in e) return '2x'
      if ('_lpos' in e) return '3x'
    }
  }
  return '2x'
}

// ── CC 2.x Parser ─────────────────────────────────────────────────────────────

function parseNode2x(raw: RawEntry[], idx: number): CCSceneNode {
  const e = raw[idx]

  // _trs TypedArray → position/rotation/scale
  const trs = parseTRS2x(e._trs)

  // Size (contentSize)
  const cs = e._contentSize as { width?: number; height?: number } | undefined
  const size: CCVec2 = { x: cs?.width ?? 0, y: cs?.height ?? 0 }

  // Anchor
  const ap = e._anchorPoint as { x?: number; y?: number } | undefined
  const anchor: CCVec2 = { x: ap?.x ?? 0.5, y: ap?.y ?? 0.5 }

  // Opacity & Color
  const opacity = typeof e._opacity === 'number' ? e._opacity : 255
  const rc = e._color as { r?: number; g?: number; b?: number; a?: number } | undefined
  const color: CCColor = { r: rc?.r ?? 255, g: rc?.g ?? 255, b: rc?.b ?? 255, a: rc?.a ?? 255 }

  // Components (skip cc.CompPrefabInfo)
  const comps = resolveComponents2x(raw, e._components as { __id__: number }[] | undefined)

  // Children (recursive)
  const childRefs = (e._children as { __id__: number }[] | undefined) ?? []
  const children = childRefs
    .map(r => r.__id__)
    .filter(i => i > 0 && i < raw.length)
    .map(i => parseNode2x(raw, i))

  return {
    uuid: (e._id as string | undefined) ?? `_idx${idx}`,
    name: (e._name as string | undefined) ?? '',
    active: (e._active as boolean | undefined) ?? true,
    position: trs.position,
    rotation: trs.rotationZ,   // 2x stores Z-axis rotation (euler)
    scale: trs.scale,
    size,
    anchor,
    opacity,
    color,
    components: comps,
    children,
    _rawIndex: idx,
  }
}

/**
 * CC 2.x _trs TypedArray 파싱
 * array[0..2] = position xyz
 * array[3..6] = quaternion xyzw
 * array[7..9] = scale xyz
 */
function parseTRS2x(trs: unknown): { position: CCVec3; rotationZ: number; scale: CCVec3 } {
  const defaults = {
    position: { x: 0, y: 0, z: 0 } as CCVec3,
    rotationZ: 0,
    scale: { x: 1, y: 1, z: 1 } as CCVec3,
  }
  if (!trs || typeof trs !== 'object') return defaults
  const t = trs as RawEntry
  if (t.__type__ !== 'TypedArray') return defaults
  const a = t.array as number[] | undefined
  if (!Array.isArray(a) || a.length < 10) return defaults

  // Quaternion → Z-axis euler (2D game: only Z rotation matters)
  const qw = a[6], qz = a[5]
  const sinZ = 2 * qw * qz
  const cosZ = 1 - 2 * qz * qz
  const rotZDeg = Math.atan2(sinZ, cosZ) * (180 / Math.PI)

  return {
    position: { x: a[0], y: a[1], z: a[2] },
    rotationZ: Math.round(rotZDeg * 1000) / 1000,
    scale: { x: a[7], y: a[8], z: a[9] },
  }
}

function resolveComponents2x(
  raw: RawEntry[],
  refs: { __id__: number }[] | undefined
): CCSceneComponent[] {
  if (!refs) return []
  return refs
    .map(r => raw[r.__id__])
    .filter((e): e is RawEntry => !!e && e.__type__ !== 'cc.CompPrefabInfo')
    .map(e => {
      const type = (e.__type__ as string | undefined) ?? ''
      const props: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(e)) {
        if (k === '__type__' || k === 'node' || k.startsWith('__')) continue
        // _N$ prefix: Label, Button, Layout 등 native props
        if (k.startsWith('_N$')) {
          props[k.slice(3)] = v
        } else {
          props[k.startsWith('_') ? k.slice(1) : k] = v
        }
      }
      return { type, props }
    })
}

// ── CC 3.x Parser ─────────────────────────────────────────────────────────────

/**
 * UITransform 컴포넌트 맵 빌드
 * key: node의 flat 배열 인덱스
 * value: { w, h, ax, ay }
 */
function buildUiTransformMap(
  raw: RawEntry[]
): Map<number, { w: number; h: number; ax: number; ay: number }> {
  const map = new Map<number, { w: number; h: number; ax: number; ay: number }>()
  for (const e of raw) {
    if (e.__type__ !== 'cc.UITransform') continue
    const nodeRef = e.node as { __id__?: number } | undefined
    if (nodeRef?.__id__ == null) continue
    const cs = e._contentSize as { width?: number; height?: number } | undefined
    const ap = e._anchorPoint as { x?: number; y?: number } | undefined
    map.set(nodeRef.__id__, {
      w: cs?.width ?? 0,
      h: cs?.height ?? 0,
      ax: ap?.x ?? 0.5,
      ay: ap?.y ?? 0.5,
    })
  }
  return map
}

function parseNode3x(
  raw: RawEntry[],
  idx: number,
  uiMap: Map<number, { w: number; h: number; ax: number; ay: number }>
): CCSceneNode {
  const e = raw[idx]

  // CC 3.x position/rotation/scale: _lpos/_lrot(euler)/_lscale
  const lpos = e._lpos as { x?: number; y?: number; z?: number } | undefined
  const lrot = e._lrot as { x?: number; y?: number; z?: number } | undefined
  const lscale = e._lscale as { x?: number; y?: number; z?: number } | undefined

  const position: CCVec3 = { x: lpos?.x ?? 0, y: lpos?.y ?? 0, z: lpos?.z ?? 0 }
  const rotation: CCVec3 = { x: lrot?.x ?? 0, y: lrot?.y ?? 0, z: lrot?.z ?? 0 }
  const scale: CCVec3 = { x: lscale?.x ?? 1, y: lscale?.y ?? 1, z: lscale?.z ?? 1 }

  // Size/Anchor from UITransform (CC 3.x separates transform from size)
  const ui = uiMap.get(idx)
  const size: CCVec2 = { x: ui?.w ?? 0, y: ui?.h ?? 0 }
  const anchor: CCVec2 = { x: ui?.ax ?? 0.5, y: ui?.ay ?? 0.5 }

  // Opacity: CC 3.x stores in _uiProps._localOpacity (0~1)
  const uiProps = e._uiProps as { _localOpacity?: number } | undefined
  const opacity =
    typeof uiProps?._localOpacity === 'number'
      ? Math.round(uiProps._localOpacity * 255)
      : 255

  const rc = e._color as { r?: number; g?: number; b?: number; a?: number } | undefined
  const color: CCColor = { r: rc?.r ?? 255, g: rc?.g ?? 255, b: rc?.b ?? 255, a: rc?.a ?? 255 }

  const layer = typeof e._layer === 'number' ? e._layer : undefined

  const comps = resolveComponents3x(raw, e._components as { __id__: number }[] | undefined)

  const childRefs = (e._children as { __id__: number }[] | undefined) ?? []
  const children = childRefs
    .map(r => r.__id__)
    .filter(i => i > 0 && i < raw.length)
    .map(i => parseNode3x(raw, i, uiMap))

  return {
    uuid: (e._id as string | undefined) ?? `_idx${idx}`,
    name: (e._name as string | undefined) ?? '',
    active: (e._active as boolean | undefined) ?? true,
    position,
    rotation,
    scale,
    size,
    anchor,
    opacity,
    color,
    layer,
    components: comps,
    children,
    _rawIndex: idx,
  }
}

function resolveComponents3x(
  raw: RawEntry[],
  refs: { __id__: number }[] | undefined
): CCSceneComponent[] {
  if (!refs) return []
  return refs
    .map(r => raw[r.__id__])
    .filter((e): e is RawEntry => !!e && e.__type__ !== 'cc.CompPrefabInfo')
    .map(e => {
      const type = (e.__type__ as string | undefined) ?? ''
      const props: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(e)) {
        if (k === '__type__' || k === 'node' || k.startsWith('__')) continue
        props[k.startsWith('_') ? k.slice(1) : k] = v
      }
      return { type, props }
    })
}
