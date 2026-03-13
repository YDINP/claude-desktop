import fs from 'fs'
import type {
  CCSceneNode, CCSceneComponent, CCSceneFile,
  CCVec2, CCVec3, CCColor, CCFileProjectInfo,
} from '../../shared/ipc-schema'

type RawEntry = Record<string, unknown>

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * CC 2.x .fire / CC 3.x .scene / .prefab 파일 파싱 → CCSceneFile
 * - flat JSON 배열 → CCSceneNode 트리로 변환
 * - 파일 확장자(.fire/.scene/.prefab) 또는 내부 필드(_trs/_lpos)로 버전 자동 감지
 */
export function parseCCScene(scenePath: string, projectInfo: CCFileProjectInfo): CCSceneFile {
  const raw = JSON.parse(fs.readFileSync(scenePath, 'utf-8')) as RawEntry[]
  const version = projectInfo.version ?? detectVersionFromRaw(raw)

  // SceneAsset → scene ref, Prefab → data ref, 없으면 cc.Scene / cc.Node 탐색
  const rootIdx = resolveRootIdx(raw)
  if (rootIdx < 0) throw new Error(`씬 루트 노드를 찾을 수 없습니다: ${scenePath}`)

  const root =
    version === '2x'
      ? parseNode2x(raw, rootIdx)
      : parseNode3x(raw, rootIdx, buildUiTransformMap(raw))

  if (!root) throw new Error(`루트 노드 파싱 실패 (depth 초과): ${scenePath}`)

  return { projectInfo, scenePath, root, _raw: raw }
}

function resolveRootIdx(raw: RawEntry[]): number {
  for (const e of raw) {
    // Prefab: data 필드가 ref
    if (e.__type__ === 'cc.Prefab') {
      const dataRef = e.data as { __id__?: number } | undefined
      if (dataRef?.__id__ != null) return dataRef.__id__
    }
    // SceneAsset / SceneGraphAsset: scene 필드가 ref
    if (e.__type__ === 'cc.SceneAsset' || e.__type__ === 'cc.SceneGraphAsset') {
      const sceneRef = e.scene as { __id__?: number } | undefined
      if (sceneRef?.__id__ != null) return sceneRef.__id__
    }
  }
  // 폴백: cc.Scene or cc.Node (인덱스 기반)
  const sceneIdx = raw.findIndex(e => e.__type__ === 'cc.Scene')
  if (sceneIdx >= 0) return sceneIdx
  return raw.findIndex(e => e.__type__ === 'cc.Node')
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

function parseNode2x(raw: RawEntry[], idx: number, depth = 0): CCSceneNode | null {
  if (depth > 100) return null
  const e = raw[idx]

  // R1396: _trs TypedArray → position/rotation/scale (base64 + 개별 필드 폴백)
  const trs = parseTRS2x(e._trs, e)

  // Size (contentSize)
  const cs = e._contentSize as { width?: number; height?: number } | undefined
  const size: CCVec2 = { x: cs?.width ?? 0, y: cs?.height ?? 0 }

  // R1396: Anchor — 없으면 기본값 {x:0.5, y:0.5} 보장
  const ap = e._anchorPoint as { x?: number; y?: number } | undefined
  const anchor: CCVec2 = { x: ap?.x ?? 0.5, y: ap?.y ?? 0.5 }

  // R1396: Opacity — 없으면 255 기본값
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
    .map(i => parseNode2x(raw, i, depth + 1))
    .filter((n): n is CCSceneNode => n !== null)

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
 * CC 2.x _trs TypedArray 파싱 (R1396 강화)
 * array[0..2] = position xyz
 * array[3..6] = quaternion xyzw
 * array[7..9] = scale xyz
 *
 * R1396: base64 인코딩 _trs 디코딩 + _position/_rotation/_scale 개별 필드 폴백
 */
function parseTRS2x(trs: unknown, entry?: RawEntry): { position: CCVec3; rotationZ: number; scale: CCVec3 } {
  const defaults = {
    position: { x: 0, y: 0, z: 0 } as CCVec3,
    rotationZ: 0,
    scale: { x: 1, y: 1, z: 1 } as CCVec3,
  }

  // 1) _trs TypedArray 파싱 (기존 로직)
  if (trs && typeof trs === 'object') {
    const t = trs as RawEntry
    if (t.__type__ === 'TypedArray') {
      let a = t.array as number[] | string | undefined
      // R1396: base64 인코딩된 경우 디코딩
      if (typeof a === 'string') {
        try {
          const buf = Buffer.from(a, 'base64')
          const ctor = (t.ctor as string) ?? 'Float64Array'
          const bytesPerElem = ctor === 'Float32Array' ? 4 : 8
          const arr: number[] = []
          for (let i = 0; i + bytesPerElem <= buf.length; i += bytesPerElem) {
            arr.push(bytesPerElem === 4 ? buf.readFloatLE(i) : buf.readDoubleLE(i))
          }
          a = arr
        } catch { a = undefined }
      }
      if (Array.isArray(a) && a.length >= 10) {
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
    }
  }

  // 2) R1396: _position / _rotation / _scale 개별 필드 폴백 (CC 2.x 구버전)
  if (entry) {
    const pos = entry._position as { x?: number; y?: number; z?: number } | undefined
    const rot = entry._rotation as { x?: number; y?: number; z?: number; w?: number } | undefined
    const scl = entry._scale as { x?: number; y?: number; z?: number } | undefined
    if (pos || rot || scl) {
      const position: CCVec3 = { x: pos?.x ?? 0, y: pos?.y ?? 0, z: pos?.z ?? 0 }
      let rotZDeg = 0
      if (rot) {
        // quaternion → euler Z
        const qw = rot.w ?? 1, qz = rot.z ?? 0
        const sinZ = 2 * qw * qz
        const cosZ = 1 - 2 * qz * qz
        rotZDeg = Math.round(Math.atan2(sinZ, cosZ) * (180 / Math.PI) * 1000) / 1000
      }
      const scale: CCVec3 = { x: scl?.x ?? 1, y: scl?.y ?? 1, z: scl?.z ?? 1 }
      return { position, rotationZ: rotZDeg, scale }
    }
  }

  return defaults
}

// ── R1380: 컴포넌트별 주요 속성 추출 ─────────────────────────────────────────

// R1417: cc.Label 폰트 필드 강화 파싱 (2x/3x)
const LABEL_EXTRACTOR_2X = (e: RawEntry): Record<string, unknown> => ({
  string: e._N$string ?? e.string ?? '',
  fontSize: e._N$fontSize ?? e._fontSize ?? 0,
  lineHeight: e._N$lineHeight ?? e._lineHeight ?? 0,
  horizontalAlign: e._N$horizontalAlign ?? e._horizontalAlign ?? 0,
  verticalAlign: e._N$verticalAlign ?? e._verticalAlign ?? 0,
  font: e._N$font ?? undefined,           // BMFont UUID 참조
  fontFamily: e._N$fontFamily ?? '',       // 시스템 폰트 이름
  isSystemFontUsed: e._N$isSystemFontUsed ?? true,
  spacingX: e._N$spacingX ?? 0,
  spacingY: e._N$spacingY ?? 0,
  overflow: e._N$overflow ?? 0,            // 0=NONE, 1=CLAMP, 2=SHRINK, 3=RESIZE_HEIGHT
})

const LABEL_EXTRACTOR_3X = (e: RawEntry): Record<string, unknown> => ({
  string: e._string ?? e.string ?? '',
  fontSize: e._fontSize ?? e.fontSize ?? 0,
  lineHeight: e._lineHeight ?? e.lineHeight ?? 0,
  horizontalAlign: e._horizontalAlign ?? e.horizontalAlign ?? 0,
  verticalAlign: e._verticalAlign ?? e.verticalAlign ?? 0,
  fontFamily: e._fontFamily ?? e.fontFamily ?? '',
  isSystemFontUsed: e._isSystemFontUsed ?? e.isSystemFontUsed ?? true,
  spacingX: e._spacingX ?? e.spacingX ?? 0,
  overflow: e._overflow ?? e.overflow ?? 0,
})

const COMPONENT_PROP_EXTRACTORS: Record<string, (e: RawEntry) => Record<string, unknown>> = {
  'cc.Label': e => {
    // 2x vs 3x 감지: _N$ 접두사 여부로 판별
    if ('_N$string' in e || '_N$fontSize' in e || '_N$fontFamily' in e) return LABEL_EXTRACTOR_2X(e)
    return LABEL_EXTRACTOR_3X(e)
  },
  'cc.RichText': e => ({
    string: e._N$string ?? e.string ?? '',
    fontSize: e._N$fontSize ?? e._fontSize ?? 0,
    maxWidth: e._N$maxWidth ?? e._maxWidth ?? 0,
    lineHeight: e._N$lineHeight ?? e._lineHeight ?? 0,
  }),
  'cc.ScrollView': e => ({
    horizontal: e._N$horizontal ?? e.horizontal ?? false,
    vertical: e._N$vertical ?? e.vertical ?? true,
    inertia: e._N$inertia ?? e.inertia ?? true,
    brake: e._N$brake ?? e.brake ?? 0.75,
    elastic: e._N$elastic ?? e.elastic ?? true,
  }),
  'cc.Mask': e => ({
    type: e._N$type ?? e._type ?? 0,  // 0=RECT, 1=ELLIPSE, 2=IMAGE_STENCIL
    alphaThreshold: e._N$alphaThreshold ?? e._alphaThreshold ?? 0,
    inverted: e._N$inverted ?? e._inverted ?? false,
  }),
  'cc.PageView': e => ({
    direction: e._N$direction ?? e.direction ?? 0,  // 0=HORIZONTAL, 1=VERTICAL
    scrollThreshold: e._N$scrollThreshold ?? e.scrollThreshold ?? 0.5,
    autoPageTurningThreshold: e._N$autoPageTurningThreshold ?? e.autoPageTurningThreshold ?? 0.3,
  }),
  // R1400: ParticleSystem 컴포넌트 (3.x)
  'cc.ParticleSystem': e => {
    const sc = e._startColor as { r?: number; g?: number; b?: number; a?: number } | undefined
    const ec = e._endColor as { r?: number; g?: number; b?: number; a?: number } | undefined
    return {
      duration: e._duration ?? e.duration ?? -1,
      maxParticles: e._N$maxParticles ?? e._maxParticles ?? e.maxParticles ?? 150,
      startColor: sc ? { r: sc.r ?? 255, g: sc.g ?? 255, b: sc.b ?? 255, a: sc.a ?? 255 } : undefined,
      endColor: ec ? { r: ec.r ?? 0, g: ec.g ?? 0, b: ec.b ?? 0, a: ec.a ?? 0 } : undefined,
    }
  },
  // R1400: ParticleSystem2D 컴포넌트 (2.x)
  'cc.ParticleSystem2D': e => {
    const sc = e._startColor as { r?: number; g?: number; b?: number; a?: number } | undefined
    const ec = e._endColor as { r?: number; g?: number; b?: number; a?: number } | undefined
    return {
      duration: e._N$duration ?? e._duration ?? e.duration ?? -1,
      maxParticles: e._N$totalParticles ?? e._totalParticles ?? e.totalParticles ?? 150,
      startColor: sc ? { r: sc.r ?? 255, g: sc.g ?? 255, b: sc.b ?? 255, a: sc.a ?? 255 } : undefined,
      endColor: ec ? { r: ec.r ?? 0, g: ec.g ?? 0, b: ec.b ?? 0, a: ec.a ?? 0 } : undefined,
    }
  },
  // R1400: Camera 컴포넌트 (2.x/3.x)
  'cc.Camera': e => ({
    clearFlags: e._N$clearFlags ?? e._clearFlags ?? e.clearFlags,
    backgroundColor: (() => {
      const bg = (e._N$backgroundColor ?? e._backgroundColor ?? e.backgroundColor) as { r?: number; g?: number; b?: number; a?: number } | undefined
      return bg ? { r: bg.r ?? 0, g: bg.g ?? 0, b: bg.b ?? 0, a: bg.a ?? 255 } : undefined
    })(),
    depth: e._N$depth ?? e._depth ?? e.depth ?? 0,
    zoomRatio: e._N$zoomRatio ?? e._zoomRatio ?? e.zoomRatio ?? 1,  // 2.x
    fov: e._fov ?? e.fov ?? 45,  // 3.x
    near: e._near ?? e.near ?? 1,  // 3.x
    far: e._far ?? e.far ?? 1000,  // 3.x
  }),
  // R1400: DirectionalLight 컴포넌트
  'cc.DirectionalLight': e => {
    const lc = (e._color ?? e.color) as { r?: number; g?: number; b?: number; a?: number } | undefined
    return {
      color: lc ? { r: lc.r ?? 255, g: lc.g ?? 255, b: lc.b ?? 255, a: lc.a ?? 255 } : undefined,
      intensity: e._intensity ?? e.intensity ?? 1,
    }
  },
  // R1400: PointLight 컴포넌트
  'cc.PointLight': e => {
    const lc = (e._color ?? e.color) as { r?: number; g?: number; b?: number; a?: number } | undefined
    return {
      color: lc ? { r: lc.r ?? 255, g: lc.g ?? 255, b: lc.b ?? 255, a: lc.a ?? 255 } : undefined,
      intensity: e._intensity ?? e.intensity ?? 1,
    }
  },
}

function extractComponentProps(type: string, e: RawEntry, isCC2x: boolean): Record<string, unknown> {
  // 특화 추출기가 있으면 우선 사용
  const extractor = COMPONENT_PROP_EXTRACTORS[type]
  if (extractor) {
    const specialized = extractor(e)
    // 나머지 일반 props도 병합
    const general: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(e)) {
      if (k === '__type__' || k === 'node' || k.startsWith('__')) continue
      if (isCC2x && k.startsWith('_N$')) {
        general[k.slice(3)] = v
      } else {
        general[k.startsWith('_') ? k.slice(1) : k] = v
      }
    }
    return { ...general, ...specialized }
  }
  return {}  // 일반 처리로 폴백
}

function resolveComponents2x(
  raw: RawEntry[],
  refs: { __id__: number }[] | undefined
): CCSceneComponent[] {
  if (!refs) return []
  return refs
    .map(r => ({ e: raw[r.__id__], idx: r.__id__ }))
    .filter((item): item is { e: RawEntry; idx: number } => !!item.e && item.e.__type__ !== 'cc.CompPrefabInfo')
    .map(({ e, idx }) => {
      const type = (e.__type__ as string | undefined) ?? ''
      const specialized = extractComponentProps(type, e, true)
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
      return { type, props: { ...props, ...specialized }, _rawIndex: idx }
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
  uiMap: Map<number, { w: number; h: number; ax: number; ay: number }>,
  depth = 0
): CCSceneNode | null {
  if (depth > 100) return null
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
    .map(i => parseNode3x(raw, i, uiMap, depth + 1))
    .filter((n): n is CCSceneNode => n !== null)

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
    .map(r => ({ e: raw[r.__id__], idx: r.__id__ }))
    .filter((item): item is { e: RawEntry; idx: number } => !!item.e && item.e.__type__ !== 'cc.CompPrefabInfo')
    .map(({ e, idx }) => {
      const type = (e.__type__ as string | undefined) ?? ''
      const specialized = extractComponentProps(type, e, false)
      const props: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(e)) {
        if (k === '__type__' || k === 'node' || k.startsWith('__')) continue
        props[k.startsWith('_') ? k.slice(1) : k] = v
      }
      return { type, props: { ...props, ...specialized }, _rawIndex: idx }
    })
}

// ── R1408: 씬 복잡도 분석 함수 ──────────────────────────────────────────────

export interface CCSceneAnalysis {
  totalNodes: number
  activeNodes: number
  maxDepth: number
  componentCounts: Record<string, number>
  estimatedDrawCalls: number
  warnings: string[]
}

/**
 * R1408: 씬 파일 전체 복잡도 분석
 * - 노드 수, 최대 깊이, 컴포넌트 분포, 추정 draw call, 경고 생성
 */
export function analyzeScene(sceneFile: CCSceneFile): CCSceneAnalysis {
  let totalNodes = 0
  let activeNodes = 0
  let maxDepth = 0
  const componentCounts: Record<string, number> = {}
  const warnings: string[] = []

  function walk(node: CCSceneNode, depth: number): void {
    totalNodes++
    if (node.active !== false) activeNodes++
    if (depth > maxDepth) maxDepth = depth

    for (const comp of node.components) {
      componentCounts[comp.type] = (componentCounts[comp.type] ?? 0) + 1
    }

    for (const child of node.children) {
      walk(child, depth + 1)
    }
  }

  walk(sceneFile.root, 0)

  // 추정 draw call: Label + Sprite 수 합산 (각각 최소 1 draw call)
  const DRAW_CALL_TYPES = ['cc.Label', 'cc.Sprite', 'cc.Sprite2D', 'cc.RichText', 'cc.Graphics']
  const estimatedDrawCalls = DRAW_CALL_TYPES.reduce((sum, type) => sum + (componentCounts[type] ?? 0), 0)

  // 경고 생성
  if (totalNodes > 200) warnings.push(`노드 ${totalNodes}개 — 200개 초과 (성능 주의)`)
  if (totalNodes > 500) warnings.push(`노드 ${totalNodes}개 — 500개 초과 (심각한 성능 저하 우려)`)
  if (maxDepth > 10) warnings.push(`중첩 깊이 ${maxDepth} — 10 초과 (구조 단순화 권장)`)
  if (maxDepth > 20) warnings.push(`중첩 깊이 ${maxDepth} — 20 초과 (심각한 구조 문제)`)
  if (estimatedDrawCalls > 100) warnings.push(`추정 draw call ${estimatedDrawCalls} — 100 초과 (렌더링 최적화 필요)`)
  if ((componentCounts['cc.Label'] ?? 0) > 50) warnings.push(`Label ${componentCounts['cc.Label']}개 — 50개 초과 (동적 배칭 확인)`)

  return { totalNodes, activeNodes, maxDepth, componentCounts, estimatedDrawCalls, warnings }
}
