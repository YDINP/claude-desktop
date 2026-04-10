import fs from 'fs'
import type {
  CCSceneNode, CCSceneComponent, CCSceneFile,
  CCVec2, CCVec3, CCColor, CCFileProjectInfo,
} from '../../shared/ipc-schema'
import { buildUUIDMap } from './cc-asset-resolver'
// CCSceneNode is used by extractSceneMeta (R1459)

type RawEntry = Record<string, unknown>

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * CC 2.x .fire / CC 3.x .scene / .prefab 파일 파싱 → CCSceneFile
 * - flat JSON 배열 → CCSceneNode 트리로 변환
 * - 파일 확장자(.fire/.scene/.prefab) 또는 내부 필드(_trs/_lpos)로 버전 자동 감지
 */
export async function parseCCScene(scenePath: string, projectInfo: CCFileProjectInfo): Promise<CCSceneFile> {
  let raw: RawEntry[]
  try {
    raw = JSON.parse(fs.readFileSync(scenePath, 'utf-8')) as RawEntry[]
  } catch (e) {
    throw new Error(`씬 파일 파싱 실패: ${e instanceof Error ? e.message : String(e)}`)
  }
  const version = projectInfo.version ?? detectVersionFromRaw(raw)

  // SceneAsset → scene ref, Prefab → data ref, 없으면 cc.Scene / cc.Node 탐색
  const rootIdx = resolveRootIdx(raw)
  if (rootIdx < 0) throw new Error(`씬 루트 노드를 찾을 수 없습니다: ${scenePath}`)

  const root =
    version === '2x'
      ? parseNode2x(raw, rootIdx)
      : parseNode3x(raw, rootIdx, buildUiTransformMap(raw))

  if (!root) throw new Error(`루트 노드 파싱 실패 (depth 초과): ${scenePath}`)

  // 커스텀 스크립트 UUID → 파일명 해결 + scriptNames 맵 (인스펙터 표시용)
  const scriptNames: Record<string, string> = {}
  if (projectInfo.assetsDir) {
    const uuidMap = await buildUUIDMap(projectInfo.assetsDir)
    const scriptUuidToName = new Map<string, string>()
    for (const [uuid, meta] of uuidMap) {
      if (meta.type === 'script') {
        const name = meta.relPath.split('/').pop()?.replace(/\.(ts|js)$/, '') ?? uuid
        scriptUuidToName.set(uuid, name)
        scriptNames[uuid] = name
      }
    }
    if (scriptUuidToName.size > 0) {
      // CC 2.x: Base62 UUID (alphanumeric), CC 3.x: dashed hex UUID
      // dot(.)이 없는 컴포넌트 타입 → UUID일 가능성 있음 (map 직접 조회)
      function resolveCompTypes(node: CCSceneNode) {
        for (const comp of node.components) {
          if (!comp.type.includes('.')) {
            const resolved = scriptUuidToName.get(comp.type)
            if (resolved) (comp as CCSceneComponent).type = resolved
          }
        }
        node.children.forEach(resolveCompTypes)
      }
      resolveCompTypes(root)
    }
  }

  return { projectInfo, scenePath, root, _raw: raw, scriptNames }
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
  const compRefArr = e._components as { __id__: number }[] | undefined
  const comps = resolveComponents2x(raw, compRefArr)

  // R1453: 이벤트 핸들러 파싱
  const eventHandlers = extractEventHandlers(raw, compRefArr)

  // Children (recursive)
  const childRefs = (e._children as { __id__: number }[] | undefined) ?? []
  const children = childRefs
    .map(r => r.__id__)
    .filter(i => i > 0 && i < raw.length)
    .map(i => parseNode2x(raw, i, depth + 1))
    .filter((n): n is CCSceneNode => n !== null)

  // R1532: CC2.x _tag 파싱
  const tag = typeof e._tag === 'number' ? e._tag : undefined

  return {
    uuid: ((e._id as string | undefined) || undefined) ?? `_idx${idx}`,
    name: (e._name as string | undefined) ?? '',
    active: (e._active as boolean | undefined) ?? true,
    position: trs.position,
    rotation: trs.rotationZ,   // 2x stores Z-axis rotation (euler)
    scale: trs.scale,
    size,
    anchor,
    opacity,
    color,
    ...(tag != null ? { tag } : {}),
    components: comps,
    children,
    ...(eventHandlers.length > 0 ? { eventHandlers } : {}),
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
  // cc.RichText: R1585로 통합 (아래 항목 참조)
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
  // R1425: ProgressBar 컴포넌트
  'cc.ProgressBar': e => ({
    progress: e._N$progress ?? e._progress ?? e.progress ?? 0,
    totalLength: e._N$totalLength ?? e._totalLength ?? e.totalLength ?? 0,
    reverse: e._N$reverse ?? e._reverse ?? e.reverse ?? false,
  }),
  // R1425: Slider 컴포넌트
  'cc.Slider': e => ({
    value: e._N$value ?? e._value ?? e.value ?? 0,
    progress: e._N$progress ?? e._progress ?? e.progress ?? 0,
    reverse: e._N$reverse ?? e._reverse ?? e.reverse ?? false,
    direction: e._N$direction ?? e._direction ?? e.direction ?? 0,
  }),
  // R1400: ParticleSystem 컴포넌트 (3.x) — R1606: R1540 통합 예정 (아래 항목이 최신)
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
  // R1400: Camera 컴포넌트 (2.x/3.x) — R1606: R1540 통합 예정 (아래 항목이 최신)
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
  // R1520: cc.Toggle (R1587로 통합 — 아래 항목 참조)
  // R1520: cc.AudioSource — 오디오 클립 설정
  'cc.AudioSource': e => ({
    clip: e._N$clip ?? e._clip ?? e.clip,
    volume: e._N$volume ?? e._volume ?? e.volume ?? 1,
    loop: e._N$loop ?? e._loop ?? e.loop ?? false,
    playOnLoad: e._N$playOnLoad ?? e._playOnLoad ?? e.playOnLoad ?? false,
    pitch: e._pitch ?? e.pitch ?? 1,
  }),
  // R1520: cc.VideoPlayer — 비디오 플레이어
  'cc.VideoPlayer': e => ({
    resourceType: e._N$resourceType ?? e._resourceType ?? e.resourceType ?? 0,
    remoteURL: e._N$remoteURL ?? e._remoteURL ?? e.remoteURL ?? '',
    volume: e._N$volume ?? e._volume ?? e.volume ?? 1,
    loop: e._N$loop ?? e._loop ?? e.loop ?? false,
    mute: e._N$mute ?? e._mute ?? e.mute ?? false,
    keepAspectRatio: e._N$keepAspectRatio ?? e._keepAspectRatio ?? e.keepAspectRatio ?? true,
    isFullscreen: e._N$isFullscreen ?? e._isFullscreen ?? e.isFullscreen ?? false,
  }),
  // R1524: cc.Animation — 기본 props (클립 이름은 resolveComponents*에서 해결)
  'cc.Animation': e => ({
    playOnLoad: e._N$playOnLoad ?? e._playOnLoad ?? e.playOnLoad ?? false,
  }),
  // R1584: cc.Layout — 자동 레이아웃 컴포넌트
  'cc.Layout': e => ({
    type: (e._N$layoutType ?? e._N$type ?? e._layoutType ?? e.layoutType ?? e.type ?? 0) as number,
    resizeMode: (e._N$resizeMode ?? e._resizeMode ?? e.resizeMode ?? 0) as number,
    paddingLeft: (e._N$paddingLeft ?? e._paddingLeft ?? e.paddingLeft ?? 0) as number,
    paddingRight: (e._N$paddingRight ?? e._paddingRight ?? e.paddingRight ?? 0) as number,
    paddingTop: (e._N$paddingTop ?? e._paddingTop ?? e.paddingTop ?? 0) as number,
    paddingBottom: (e._N$paddingBottom ?? e._paddingBottom ?? e.paddingBottom ?? 0) as number,
    spacingX: (e._N$spacingX ?? e._spacingX ?? e.spacingX ?? 0) as number,
    spacingY: (e._N$spacingY ?? e._spacingY ?? e.spacingY ?? 0) as number,
    autoWrap: !!(e._N$autoWrap ?? e._autoWrap ?? e.autoWrap ?? false),
    startAxis: (e._N$startAxis ?? e._startAxis ?? e.startAxis ?? 0) as number,
  }),
  // R1587: cc.Toggle — 체크박스/라디오 토글 (R1520 통합)
  'cc.Toggle': e => ({
    isChecked: !!(e._N$isChecked ?? e._isChecked ?? e.isChecked ?? false),
    checkMark: e._N$checkMark ?? e._checkMark ?? e.checkMark,
    interactable: !!(e._N$interactable ?? e._interactable ?? e.interactable ?? true),
  }),
  // R1587: cc.ToggleContainer — 토글 그룹 컨테이너
  'cc.ToggleContainer': e => ({
    allowSwitchOff: !!(e._N$allowSwitchOff ?? e._allowSwitchOff ?? e.allowSwitchOff ?? false),
  }),
  // R1590: cc.Graphics — 벡터 그래픽 컴포넌트
  'cc.Graphics': e => {
    const fc = e._N$fillColor ?? e._fillColor ?? e.fillColor as { r?: number; g?: number; b?: number; a?: number } | undefined
    const sc = e._N$strokeColor ?? e._strokeColor ?? e.strokeColor as { r?: number; g?: number; b?: number; a?: number } | undefined
    return {
      lineWidth: (e._N$lineWidth ?? e._lineWidth ?? e.lineWidth ?? 1) as number,
      fillColor: fc ? { r: (fc as { r?: number }).r ?? 255, g: (fc as { g?: number }).g ?? 255, b: (fc as { b?: number }).b ?? 255, a: (fc as { a?: number }).a ?? 255 } : undefined,
      strokeColor: sc ? { r: (sc as { r?: number }).r ?? 0, g: (sc as { g?: number }).g ?? 0, b: (sc as { b?: number }).b ?? 0, a: (sc as { a?: number }).a ?? 255 } : undefined,
    }
  },
  // R1589: cc.Sprite / cc.Sprite2D — 스프라이트 컴포넌트
  'cc.Sprite': e => ({
    type: (e._N$type ?? e._type ?? e.type ?? 0) as number,  // 0=SIMPLE,1=SLICED,2=TILED,3=FILLED
    sizeMode: (e._N$sizeMode ?? e._sizeMode ?? e.sizeMode ?? 1) as number,  // 0=CUSTOM,1=TRIMMED,2=RAW
    trim: !!(e._N$trim ?? e._trim ?? e.trim ?? true),
    grayscale: !!(e._N$grayscale ?? e._grayscale ?? e.grayscale ?? false),
  }),
  'cc.Sprite2D': e => ({
    type: (e._N$type ?? e._type ?? e.type ?? 0) as number,
    sizeMode: (e._N$sizeMode ?? e._sizeMode ?? e.sizeMode ?? 1) as number,
    trim: !!(e._N$trim ?? e._trim ?? e.trim ?? true),
    grayscale: !!(e._N$grayscale ?? e._grayscale ?? e.grayscale ?? false),
  }),
  // R1588: cc.LabelOutline — 텍스트 아웃라인 효과
  'cc.LabelOutline': e => {
    const color = e._N$color ?? e._color ?? e.color as { r?: number; g?: number; b?: number; a?: number } | undefined
    return {
      width: (e._N$width ?? e._width ?? e.width ?? 0) as number,
      color: color ? { r: (color as { r?: number }).r ?? 0, g: (color as { g?: number }).g ?? 0, b: (color as { b?: number }).b ?? 0, a: (color as { a?: number }).a ?? 255 } : { r: 0, g: 0, b: 0, a: 255 },
    }
  },
  // R1588: cc.LabelShadow — 텍스트 그림자 효과
  'cc.LabelShadow': e => {
    const color = e._N$color ?? e._color ?? e.color as { r?: number; g?: number; b?: number; a?: number } | undefined
    return {
      offset: { x: (e._N$offsetX ?? e._offsetX ?? e.offsetX ?? 2) as number, y: (e._N$offsetY ?? e._offsetY ?? e.offsetY ?? -2) as number },
      blur: (e._N$blur ?? e._blur ?? e.blur ?? 2) as number,
      color: color ? { r: (color as { r?: number }).r ?? 0, g: (color as { g?: number }).g ?? 0, b: (color as { b?: number }).b ?? 0, a: (color as { a?: number }).a ?? 255 } : { r: 0, g: 0, b: 0, a: 255 },
    }
  },
  // R1586: cc.EditBox — 텍스트 입력 필드
  'cc.EditBox': e => ({
    string: (e._N$string ?? e._string ?? e.string ?? '') as string,
    placeholder: (e._N$placeholder ?? e._placeholder ?? e.placeholder ?? '') as string,
    maxLength: (e._N$maxLength ?? e._maxLength ?? e.maxLength ?? 20) as number,
    fontSize: (e._N$fontSize ?? e._fontSize ?? e.fontSize ?? 20) as number,
    inputMode: (e._N$inputMode ?? e._inputMode ?? e.inputMode ?? 0) as number,
    inputFlag: (e._N$inputFlag ?? e._inputFlag ?? e.inputFlag ?? 0) as number,
    returnType: (e._N$returnType ?? e._returnType ?? e.returnType ?? 0) as number,
  }),
  // R1585: cc.RichText — 서식 있는 텍스트
  'cc.RichText': e => ({
    string: (e._N$string ?? e._string ?? e.string ?? '') as string,
    maxWidth: (e._N$maxWidth ?? e._maxWidth ?? e.maxWidth ?? 0) as number,
    fontSize: (e._N$fontSize ?? e._fontSize ?? e.fontSize ?? 40) as number,
    lineHeight: (e._N$lineHeight ?? e._lineHeight ?? e.lineHeight ?? 40) as number,
    horizontalAlign: (e._N$horizontalAlign ?? e._horizontalAlign ?? e.horizontalAlign ?? 0) as number,
    overflow: (e._N$overflow ?? e._overflow ?? e.overflow ?? 0) as number,
  }),
  // R1582: cc.Widget — 레이아웃 제약 컴포넌트
  'cc.Widget': e => ({
    alignFlags: (e._N$alignFlags ?? e._alignFlags ?? e.alignFlags ?? 0) as number,
    isAlignTop: !!(e._N$isAlignTop ?? e._isAlignTop ?? e.isAlignTop ?? false),
    isAlignBottom: !!(e._N$isAlignBottom ?? e._isAlignBottom ?? e.isAlignBottom ?? false),
    isAlignLeft: !!(e._N$isAlignLeft ?? e._isAlignLeft ?? e.isAlignLeft ?? false),
    isAlignRight: !!(e._N$isAlignRight ?? e._isAlignRight ?? e.isAlignRight ?? false),
    top: (e._N$top ?? e._top ?? e.top ?? 0) as number,
    bottom: (e._N$bottom ?? e._bottom ?? e.bottom ?? 0) as number,
    left: (e._N$left ?? e._left ?? e.left ?? 0) as number,
    right: (e._N$right ?? e._right ?? e.right ?? 0) as number,
    horizontalCenter: (e._N$horizontalCenter ?? e._horizontalCenter ?? e.horizontalCenter ?? 0) as number,
    verticalCenter: (e._N$verticalCenter ?? e._verticalCenter ?? e.verticalCenter ?? 0) as number,
    alignMode: (e._N$alignMode ?? e._alignMode ?? e.alignMode ?? 1) as number,  // 0=ONCE,1=ALWAYS,2=EDITOR
  }),
  // R1581: cc.Button — 버튼 상태 색상 + transition
  'cc.Button': e => {
    const toColor = (v: unknown) => {
      const c = v as { r?: number; g?: number; b?: number; a?: number } | undefined
      return c ? { r: c.r ?? 255, g: c.g ?? 255, b: c.b ?? 255, a: c.a ?? 255 } : undefined
    }
    return {
      transition: (e._N$transition ?? e._transition ?? e.transition ?? 0) as number,  // 0=NONE,1=COLOR,2=SPRITE,3=SCALE
      duration: (e._N$duration ?? e._duration ?? e.duration ?? 0.1) as number,
      zoomScale: (e._N$zoomScale ?? e._zoomScale ?? e.zoomScale ?? 1.2) as number,
      normalColor: toColor(e._N$normalColor ?? e._normalColor ?? e.normalColor),
      hoverColor: toColor(e._N$hoverColor ?? e._hoverColor ?? e.hoverColor),
      pressedColor: toColor(e._N$pressedColor ?? e._pressedColor ?? e.pressedColor),
      disabledColor: toColor(e._N$disabledColor ?? e._disabledColor ?? e.disabledColor),
      interactable: !!(e._N$interactable ?? e._interactable ?? e.interactable ?? true),
    }
  },
  // R1579: cc.SkeletalAnimation — CC3.x 스켈레탈 애니메이션
  'cc.SkeletalAnimation': e => ({
    playOnLoad: !!(e._playOnLoad ?? e.playOnLoad ?? false),
    speedRatio: (e._speedRatio ?? e.speedRatio ?? 1) as number,
    // _defaultClip 이름 추출 (embedded 또는 uuid 형식)
    defaultClipName: (() => {
      const dc = e._defaultClip as { __id__?: number; __uuid__?: string; _name?: string } | undefined
      return (dc?._name ?? dc?.__uuid__?.slice(0, 8) ?? '') as string
    })(),
  }),
  // R1538: cc.EditBox (R1586으로 통합 — 위 항목 참조)
  // R1540 + R1400 통합 (R1606 dedup): cc.Camera — 2.x/3.x 통합
  'cc.Camera': e => ({
    clearFlags: e._N$clearFlags ?? e._clearFlags ?? e.clearFlags ?? 7,
    backgroundColor: (() => {
      const bg = (e._N$backgroundColor ?? e._backgroundColor ?? e.backgroundColor) as { r?: number; g?: number; b?: number; a?: number } | undefined
      return bg ? { r: bg.r ?? 0, g: bg.g ?? 0, b: bg.b ?? 0, a: bg.a ?? 255 } : undefined
    })(),
    depth: e._N$depth ?? e._depth ?? e.depth ?? 0,
    cullingMask: e._N$cullingMask ?? e._cullingMask ?? e.cullingMask ?? 0xFFFFFFFF,
    zoomRatio: e._N$zoomRatio ?? e._zoomRatio ?? e.zoomRatio ?? 1,
    fov: e._N$fov ?? e._fov ?? e.fov ?? 45,
    near: e._near ?? e.near ?? 1,
    nearClip: e._N$nearClip ?? e._nearClip ?? e.nearClip ?? 0.1,
    far: e._far ?? e.far ?? 1000,
    farClip: e._N$farClip ?? e._farClip ?? e.farClip ?? 4096,
  }),
  // R1540 + R1400 통합 (R1606 dedup): cc.ParticleSystem — 2.x/3.x 통합
  'cc.ParticleSystem': e => {
    const sc = (e._startColor ?? e.startColor) as { r?: number; g?: number; b?: number; a?: number } | undefined
    const ec = (e._endColor ?? e.endColor) as { r?: number; g?: number; b?: number; a?: number } | undefined
    return {
      totalParticles: e._N$totalParticles ?? e._totalParticles ?? e.totalParticles ?? e._N$maxParticles ?? e._maxParticles ?? 150,
      duration: e._N$duration ?? e._duration ?? e.duration ?? -1,
      emissionRate: e._N$emissionRate ?? e._emissionRate ?? e.emissionRate ?? 10,
      life: e._N$life ?? e._life ?? e.life ?? 1,
      startSize: e._N$startSize ?? e._startSize ?? e.startSize ?? 50,
      endSize: e._N$endSize ?? e._endSize ?? e.endSize ?? 50,
      playOnLoad: e._N$playOnLoad ?? e._playOnLoad ?? e.playOnLoad ?? true,
      startColor: sc ? { r: sc.r ?? 255, g: sc.g ?? 255, b: sc.b ?? 255, a: sc.a ?? 255 } : undefined,
      endColor: ec ? { r: ec.r ?? 0, g: ec.g ?? 0, b: ec.b ?? 0, a: ec.a ?? 0 } : undefined,
    }
  },
  // R1557: cc.SafeArea — 모바일 노치/SafeArea 적용
  'cc.SafeArea': _e => ({
    // SafeArea는 적용 여부만 표시 (별도 props 없음)
    applied: true,
  }),
  // R1557: cc.BlockInputEvents — 클릭 이벤트 차단
  'cc.BlockInputEvents': _e => ({
    blocking: true,
  }),
  // R1557: cc.UIStaticBatch — UI 정적 배칭 최적화
  'cc.UIStaticBatch': _e => ({
    static: true,
  }),
  // R1556: cc.TiledMap — Tiled 맵 컴포넌트
  'cc.TiledMap': e => ({
    tmxFile: (e._N$tmxFile ?? e._tmxFile ?? e.tmxFile) as unknown,
    defaultMapSize: (e._N$defaultMapSize ?? e._defaultMapSize ?? e.defaultMapSize) as unknown,
    enabled: !!(e._N$enabled ?? e._enabled ?? e.enabled ?? true),
  }),
  // R1556: cc.TiledLayer — Tiled 레이어
  'cc.TiledLayer': e => ({
    layerName: (e._N$layerName ?? e._layerName ?? e.layerName ?? '') as string,
    visible: !!(e._N$visible ?? e._visible ?? e.visible ?? true),
    opacity: (e._N$opacity ?? e._opacity ?? e.opacity ?? 1) as number,
  }),
  // R1551: cc.RigidBody — 2D 물리 강체
  'cc.RigidBody': e => ({
    type: (e._N$type ?? e._type ?? e.type ?? 0) as number,  // 0=DYNAMIC, 1=STATIC, 2=KINEMATIC
    mass: (e._N$mass ?? e._mass ?? e.mass ?? 1) as number,
    linearDamping: (e._N$linearDamping ?? e._linearDamping ?? e.linearDamping ?? 0) as number,
    angularDamping: (e._N$angularDamping ?? e._angularDamping ?? e.angularDamping ?? 0) as number,
    gravityScale: (e._N$gravityScale ?? e._gravityScale ?? e.gravityScale ?? 1) as number,
    fixedRotation: !!(e._N$fixedRotation ?? e._fixedRotation ?? e.fixedRotation ?? false),
    allowSleep: !!(e._N$allowSleep ?? e._allowSleep ?? e.allowSleep ?? true),
    bullet: !!(e._N$bullet ?? e._bullet ?? e.bullet ?? false),
  }),
  'cc.RigidBody2D': e => ({
    type: (e._N$type ?? e._type ?? e.type ?? 0) as number,
    mass: (e._N$mass ?? e._mass ?? e.mass ?? 1) as number,
    linearDamping: (e._N$linearDamping ?? e._linearDamping ?? e.linearDamping ?? 0) as number,
    angularDamping: (e._N$angularDamping ?? e._angularDamping ?? e.angularDamping ?? 0) as number,
    gravityScale: (e._N$gravityScale ?? e._gravityScale ?? e.gravityScale ?? 1) as number,
    fixedRotation: !!(e._N$fixedRotation ?? e._fixedRotation ?? e.fixedRotation ?? false),
  }),
  // R1551: cc.BoxCollider — 박스 콜라이더
  'cc.BoxCollider': e => ({
    offset: (e._N$offset ?? e._offset ?? e.offset) as { x?: number; y?: number } | undefined,
    size: (e._N$size ?? e._size ?? e.size) as { width?: number; height?: number } | undefined,
    tag: (e._N$tag ?? e._tag ?? e.tag ?? 0) as number,
    sensor: !!(e._N$sensor ?? e._sensor ?? e.sensor ?? false),
  }),
  'cc.BoxCollider2D': e => ({
    offset: (e._N$offset ?? e._offset ?? e.offset) as { x?: number; y?: number } | undefined,
    size: (e._N$size ?? e._size ?? e.size) as { width?: number; height?: number } | undefined,
    tag: (e._N$tag ?? e._tag ?? e.tag ?? 0) as number,
    sensor: !!(e._N$sensor ?? e._sensor ?? e.sensor ?? false),
  }),
  // R1551: cc.CircleCollider — 원형 콜라이더
  'cc.CircleCollider': e => ({
    offset: (e._N$offset ?? e._offset ?? e.offset) as { x?: number; y?: number } | undefined,
    radius: (e._N$radius ?? e._radius ?? e.radius ?? 0) as number,
    tag: (e._N$tag ?? e._tag ?? e.tag ?? 0) as number,
    sensor: !!(e._N$sensor ?? e._sensor ?? e.sensor ?? false),
  }),
  'cc.CircleCollider2D': e => ({
    offset: (e._N$offset ?? e._offset ?? e.offset) as { x?: number; y?: number } | undefined,
    radius: (e._N$radius ?? e._radius ?? e.radius ?? 0) as number,
    tag: (e._N$tag ?? e._tag ?? e.tag ?? 0) as number,
    sensor: !!(e._N$sensor ?? e._sensor ?? e.sensor ?? false),
  }),
  // R1574: cc.PolygonCollider — 폴리곤 콜라이더
  'cc.PolygonCollider': e => ({
    offset: (e._N$offset ?? e._offset ?? e.offset) as { x?: number; y?: number } | undefined,
    points: (e._N$points ?? e._points ?? e.points ?? []) as Array<{ x?: number; y?: number }>,
    tag: (e._N$tag ?? e._tag ?? e.tag ?? 0) as number,
    sensor: !!(e._N$sensor ?? e._sensor ?? e.sensor ?? false),
  }),
  'cc.PolygonCollider2D': e => ({
    offset: (e._N$offset ?? e._offset ?? e.offset) as { x?: number; y?: number } | undefined,
    points: (e._N$points ?? e._points ?? e.points ?? []) as Array<{ x?: number; y?: number }>,
    tag: (e._N$tag ?? e._tag ?? e.tag ?? 0) as number,
    sensor: !!(e._N$sensor ?? e._sensor ?? e.sensor ?? false),
  }),
  // R1549: dragonBones.ArmatureDisplay — DragonBones 애니메이션
  'dragonBones.ArmatureDisplay': e => ({
    dragonAsset: (e._N$dragonAsset ?? e._dragonAsset ?? e.dragonAsset) as unknown,
    dragonAtlasAsset: (e._N$dragonAtlasAsset ?? e._dragonAtlasAsset ?? e.dragonAtlasAsset) as unknown,
    armatureName: (e._N$armatureName ?? e._armatureName ?? e.armatureName ?? '') as string,
    animationName: (e._N$animationName ?? e._animationName ?? e.animationName ?? '') as string,
    loop: !!(e._N$loop ?? e._loop ?? e.loop ?? true),
    playTimes: (e._N$playTimes ?? e._playTimes ?? e.playTimes ?? 0) as number,
    timeScale: (e._N$timeScale ?? e._timeScale ?? e.timeScale ?? 1) as number,
    debugBones: !!(e._N$debugBones ?? e._debugBones ?? e.debugBones ?? false),
  }),
  // R1546: sp.Skeleton — Spine 애니메이션
  // R1573: cc.UIOpacity — CC3.x UI 투명도 컴포넌트
  'cc.UIOpacity': e => ({
    opacity: (e._opacity ?? e.opacity ?? 255) as number,
  }),
  'sp.Skeleton': e => ({
    skeletonData: (e._N$skeletonData ?? e._skeletonData ?? e.skeletonData) as unknown,
    defaultSkin: (e._N$defaultSkin ?? e._defaultSkin ?? e.defaultSkin ?? 'default') as string,
    defaultAnimation: (e._N$defaultAnimation ?? e._defaultAnimation ?? e.defaultAnimation ?? '') as string,
    loop: !!(e._N$loop ?? e._loop ?? e.loop ?? true),
    premultipliedAlpha: !!(e._N$premultipliedAlpha ?? e._premultipliedAlpha ?? e.premultipliedAlpha ?? true),
    timeScale: (e._N$timeScale ?? e._timeScale ?? e.timeScale ?? 1) as number,
    paused: !!(e._N$paused ?? e._paused ?? e.paused ?? false),
    debugSlots: !!(e._N$debugSlots ?? e._debugSlots ?? e.debugSlots ?? false),
    debugBones: !!(e._N$debugBones ?? e._debugBones ?? e.debugBones ?? false),
  }),
}

// R1524: cc.Animation 클립 이름 해결 (embedded __id__ or external __uuid__)
function resolveAnimationClipNames(e: RawEntry, raw: RawEntry[]): { name: string }[] {
  const clipRefs = (e._N$clips ?? e._clips ?? e.clips) as unknown
  if (!Array.isArray(clipRefs)) return []
  return (clipRefs as { __id__?: number; __uuid__?: string }[]).map(ref => {
    if (ref?.__id__ != null) {
      const clip = raw[ref.__id__]
      return { name: (clip?._name as string | undefined) ?? (clip?.name as string | undefined) ?? `clip_${ref.__id__}` }
    }
    if (ref?.__uuid__) return { name: ref.__uuid__ }
    return { name: 'unknown' }
  })
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
      // R1524: cc.Animation 클립 이름 해결
      if (type === 'cc.Animation') {
        props['_resolvedClips'] = resolveAnimationClipNames(e, raw)
        const defRef = (e._N$defaultClip ?? e._defaultClip) as { __id__?: number } | null | undefined
        if (defRef?.__id__ != null) {
          const defClip = raw[defRef.__id__]
          props['_defaultClipName'] = (defClip?._name as string | undefined) ?? `clip_${defRef.__id__}`
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
    // R1493: _contentSize / contentSize fallback (CC3.x 버전별 필드명 차이)
    const cs = (e._contentSize ?? e.contentSize) as { width?: number; height?: number } | undefined
    const ap = (e._anchorPoint ?? e.anchorPoint) as { x?: number; y?: number } | undefined
    // R1493: width/height 직접 필드도 fallback
    const w = cs?.width ?? (e._width as number | undefined) ?? (e.width as number | undefined) ?? 0
    const h = cs?.height ?? (e._height as number | undefined) ?? (e.height as number | undefined) ?? 0
    map.set(nodeRef.__id__, {
      w,
      h,
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
  const lrot = e._lrot as { x?: number; y?: number; z?: number; w?: number } | undefined
  const lscale = e._lscale as { x?: number; y?: number; z?: number } | undefined

  const position: CCVec3 = { x: lpos?.x ?? 0, y: lpos?.y ?? 0, z: lpos?.z ?? 0 }

  // 3.x: _lrot quaternion → euler Z (degrees), 2.x parseTRS2x와 동일한 변환
  const qx = lrot?.x ?? 0, qy = lrot?.y ?? 0, qz = lrot?.z ?? 0, qw = lrot?.w ?? 1
  const sinZ = 2 * (qw * qz + qx * qy)
  const cosZ = 1 - 2 * (qy * qy + qz * qz)
  const eulerZ = Math.round(Math.atan2(sinZ, cosZ) * (180 / Math.PI) * 1000) / 1000
  const rotation: CCVec3 = { x: 0, y: 0, z: eulerZ }
  const lrotW: number | undefined = lrot?.w
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

  // R1479: CC3.x는 `layer` (underscore 없음), CC2.x는 `_layer` — 둘 다 시도
  const layer = typeof e.layer === 'number' ? e.layer : typeof e._layer === 'number' ? e._layer : undefined

  const compRefArr3x = e._components as { __id__: number }[] | undefined
  const comps = resolveComponents3x(raw, compRefArr3x)

  // R1453: 이벤트 핸들러 파싱
  const eventHandlers = extractEventHandlers(raw, compRefArr3x)

  const childRefs = (e._children as { __id__: number }[] | undefined) ?? []
  const children = childRefs
    .map(r => r.__id__)
    .filter(i => i > 0 && i < raw.length)
    .map(i => parseNode3x(raw, i, uiMap, depth + 1))
    .filter((n): n is CCSceneNode => n !== null)

  return {
    uuid: ((e._id as string | undefined) || undefined) ?? `_idx${idx}`,
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
    ...(eventHandlers.length > 0 ? { eventHandlers } : {}),
    _rawIndex: idx,
    ...(lrotW !== undefined ? { _lrotW: lrotW } : {}),
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
      // R1524: cc.Animation 클립 이름 해결
      if (type === 'cc.Animation') {
        props['_resolvedClips'] = resolveAnimationClipNames(e, raw)
        const defRef = e._defaultClip as { __id__?: number } | null | undefined
        if (defRef?.__id__ != null) {
          const defClip = raw[defRef.__id__]
          props['_defaultClipName'] = (defClip?._name as string | undefined) ?? `clip_${defRef.__id__}`
        }
      }
      return { type, props: { ...props, ...specialized }, _rawIndex: idx }
    })
}

// ── R1453: 이벤트 핸들러 파싱 (Button/Toggle/Slider) ─────────────────────────

type EventHandlerEntry = { component: string; event: string; handler: string; target?: string }

const EVENT_HANDLER_FIELDS: Record<string, { field: string; event: string }[]> = {
  'cc.Button': [{ field: 'clickEvents', event: 'click' }, { field: '_N$clickEvents', event: 'click' }],
  'cc.Toggle': [{ field: 'checkEvents', event: 'check' }, { field: '_N$checkEvents', event: 'check' }],
  'cc.Slider': [{ field: 'slideEvents', event: 'slide' }, { field: '_N$slideEvents', event: 'slide' }],
}

function extractEventHandlers(
  raw: RawEntry[],
  compRefs: { __id__: number }[] | undefined
): EventHandlerEntry[] {
  if (!compRefs) return []
  const handlers: EventHandlerEntry[] = []

  for (const ref of compRefs) {
    const comp = raw[ref.__id__]
    if (!comp) continue
    const compType = (comp.__type__ as string) ?? ''
    const fieldDefs = EVENT_HANDLER_FIELDS[compType]
    if (!fieldDefs) continue

    for (const { field, event } of fieldDefs) {
      const events = comp[field] as Array<{ __id__?: number } | { target?: { __id__?: number }; handler?: string; customEventData?: string }> | undefined
      if (!Array.isArray(events)) continue

      for (const ev of events) {
        // 직접 인라인 이벤트 핸들러
        if ('handler' in ev && typeof ev.handler === 'string') {
          const targetRef = ev.target as { __id__?: number } | undefined
          const targetNode = targetRef?.__id__ != null ? raw[targetRef.__id__] : undefined
          const targetName = targetNode ? ((targetNode._name as string) ?? '') : undefined
          handlers.push({ component: compType, event, handler: ev.handler, target: targetName })
          continue
        }
        // __id__ 참조 기반 이벤트 핸들러 (CC 2.x 스타일)
        const evRef = ev as { __id__?: number }
        if (evRef.__id__ != null) {
          const evEntry = raw[evRef.__id__] as RawEntry | undefined
          if (!evEntry) continue
          const handlerName = (evEntry.handler as string) ?? (evEntry._handler as string) ?? ''
          if (!handlerName) continue
          const targetRef2 = evEntry.target as { __id__?: number } | undefined
          const targetNode2 = targetRef2?.__id__ != null ? raw[targetRef2.__id__] : undefined
          const targetName2 = targetNode2 ? ((targetNode2._name as string) ?? '') : undefined
          handlers.push({ component: compType, event, handler: handlerName, target: targetName2 })
        }
      }
    }
  }

  return handlers
}

// ── R1426: 씬 노드 UUID → 경로 인덱스 빌드 ──────────────────────────────────

/**
 * R1426: UUID → "Canvas/Panel/Button" 형태의 전체 경로 반환
 */
export function buildNodePathIndex(root: CCSceneNode): Map<string, string> {
  const index = new Map<string, string>()

  function walk(node: CCSceneNode, parentPath: string): void {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name
    index.set(node.uuid, currentPath)
    for (const child of node.children) {
      walk(child, currentPath)
    }
  }

  walk(root, '')
  return index
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

// ── R1432: UUID 참조 그래프 ─────────────────────────────────────────────────

/**
 * R1432: 씬 내 노드/컴포넌트 간 UUID 참조 관계를 그래프로 구성
 * UUID → 참조하는 다른 UUID 목록 (컴포넌트 props에서 __uuid__ 추출)
 * 순환 참조 탐지에 활용 가능
 */
export function buildReferenceGraph(sceneFile: CCSceneFile): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  const raw = sceneFile._raw as RawEntry[] | undefined
  if (!raw) {
    // _raw 없으면 노드 트리에서 컴포넌트 props 기반 참조 추출
    buildRefGraphFromTree(sceneFile.root, graph)
    return graph
  }

  // raw 배열 전체 순회 — 각 엔트리의 __uuid__ 참조 수집
  const allNodeUuids = new Set<string>()
  collectNodeUuids(sceneFile.root, allNodeUuids)

  for (const entry of raw) {
    const entryId = (entry._id as string | undefined) ?? ''
    if (!entryId) continue
    const refs: string[] = []
    extractUuidRefs(entry, refs, allNodeUuids)
    if (refs.length > 0) {
      const existing = graph.get(entryId) ?? []
      graph.set(entryId, [...existing, ...refs])
    }
  }

  return graph
}

function collectNodeUuids(node: CCSceneNode, set: Set<string>): void {
  set.add(node.uuid)
  for (const child of node.children) collectNodeUuids(child, set)
}

function extractUuidRefs(obj: unknown, refs: string[], knownUuids: Set<string>): void {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) extractUuidRefs(item, refs, knownUuids)
    return
  }
  const record = obj as Record<string, unknown>
  if (typeof record.__uuid__ === 'string') {
    const uuid = record.__uuid__
    if (knownUuids.has(uuid)) refs.push(uuid)
    return
  }
  for (const val of Object.values(record)) {
    if (val && typeof val === 'object') extractUuidRefs(val, refs, knownUuids)
  }
}

function buildRefGraphFromTree(node: CCSceneNode, graph: Map<string, string[]>): void {
  const refs: string[] = []
  for (const comp of node.components) {
    if (!comp.props) continue
    for (const val of Object.values(comp.props)) {
      if (val && typeof val === 'object') {
        const r = val as Record<string, unknown>
        if (typeof r.__uuid__ === 'string') refs.push(r.__uuid__)
      }
    }
  }
  if (refs.length > 0) {
    graph.set(node.uuid, refs)
  }
  for (const child of node.children) buildRefGraphFromTree(child, graph)
}

// ── R1441: 씬 최적화 제안 ─────────────────────────────────────────────────

export interface OptimizationSuggestion {
  type: 'performance' | 'memory' | 'structure'
  severity: 'high' | 'medium' | 'low'
  message: string
  affectedUuids?: string[]
}

/**
 * R1441: 씬 분석 결과 기반 최적화 제안 생성
 * - draw call 50 초과 → Sprite Atlas 권장
 * - 노드 500 초과 → 오브젝트 풀링 권장
 * - 깊이 10 초과 → 구조 단순화 권장
 * - 비활성 노드 30% 초과 → 불필요 노드 정리 권장
 */
export function suggestOptimizations(analysis: CCSceneAnalysis): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []

  // draw call 50 초과
  if (analysis.estimatedDrawCalls > 50) {
    suggestions.push({
      type: 'performance',
      severity: analysis.estimatedDrawCalls > 100 ? 'high' : 'medium',
      message: `Draw Call이 ${analysis.estimatedDrawCalls}개입니다. Sprite Atlas 사용 권장`,
    })
  }

  // 노드 500 초과
  if (analysis.totalNodes > 500) {
    suggestions.push({
      type: 'memory',
      severity: analysis.totalNodes > 1000 ? 'high' : 'medium',
      message: `노드가 너무 많습니다 (${analysis.totalNodes}개). 오브젝트 풀링 고려`,
    })
  }

  // 깊이 10 초과
  if (analysis.maxDepth > 10) {
    suggestions.push({
      type: 'structure',
      severity: analysis.maxDepth > 20 ? 'high' : 'medium',
      message: `씬 계층이 깊습니다 (최대 ${analysis.maxDepth}). 구조 단순화 권장`,
    })
  }

  // 비활성 노드 30% 초과
  const inactiveCount = analysis.totalNodes - analysis.activeNodes
  const inactiveRatio = analysis.totalNodes > 0 ? inactiveCount / analysis.totalNodes : 0
  if (inactiveRatio > 0.3) {
    suggestions.push({
      type: 'memory',
      severity: inactiveRatio > 0.5 ? 'high' : 'medium',
      message: `비활성 노드 비율이 높습니다 (${Math.round(inactiveRatio * 100)}%). 불필요한 노드 정리 권장`,
    })
  }

  return suggestions
}

// ── R1447: Canvas 자동 감지 + 디자인 해상도 ──────────────────────────────────

/**
 * R1447: 씬 루트에서 Canvas 노드를 자동 감지
 * - cc.Canvas 컴포넌트 보유 OR 이름이 "Canvas"인 노드
 */
export function findCanvasNode(root: CCSceneNode): CCSceneNode | null {
  // cc.Canvas 컴포넌트 보유 우선
  if (root.components.some(c => c.type === 'cc.Canvas')) return root
  for (const child of root.children) {
    const found = findCanvasNode(child)
    if (found) return found
  }
  // 이름 기반 폴백 (컴포넌트 없는 경우)
  if (root.name === 'Canvas') return root
  for (const child of root.children) {
    if (child.name === 'Canvas') return child
  }
  return null
}

/**
 * R1447: 씬에서 디자인 해상도 획득
 * - 2x: cc.Canvas._designResolution 또는 _designResolution 직접 필드
 * - 3x: Camera 컴포넌트의 orthoHeight 기반 추정 (width = orthoHeight * aspect)
 * - fallback: { width: 960, height: 640 }
 */
export function getDesignResolution(sceneFile: CCSceneFile): { width: number; height: number } {
  const raw = sceneFile._raw as RawEntry[] | undefined
  const version = sceneFile.projectInfo?.version ?? '2x'

  if (version === '2x' && raw) {
    // 2x: cc.Canvas 컴포넌트에서 _designResolution 추출
    for (const entry of raw) {
      if (entry.__type__ === 'cc.Canvas') {
        const dr = entry._designResolution as { width?: number; height?: number } | undefined
        if (dr?.width && dr?.height) return { width: dr.width, height: dr.height }
        // _N$ prefix variant
        const dr2 = entry._N$designResolution as { width?: number; height?: number } | undefined
        if (dr2?.width && dr2?.height) return { width: dr2.width, height: dr2.height }
      }
    }
  }

  if (version === '3x' && raw) {
    // 3x: Camera 컴포넌트의 orthoHeight 기반 추정
    for (const entry of raw) {
      if (entry.__type__ === 'cc.Camera') {
        const orthoH = entry._orthoHeight as number | undefined
        if (orthoH && orthoH > 0) {
          // 기본 16:9 비율 가정
          return { width: Math.round(orthoH * 2 * (16 / 9)), height: orthoH * 2 }
        }
      }
    }
  }

  return { width: 960, height: 640 }
}

/**
 * R1432: 참조 그래프에서 순환 참조 탐지
 * @returns 순환에 포함된 UUID 배열 (순환 없으면 빈 배열)
 */
export function detectCycles(graph: Map<string, string[]>): string[][] {
  const visited = new Set<string>()
  const stack = new Set<string>()
  const cycles: string[][] = []

  function dfs(uuid: string, path: string[]): void {
    if (stack.has(uuid)) {
      const cycleStart = path.indexOf(uuid)
      if (cycleStart >= 0) cycles.push(path.slice(cycleStart))
      return
    }
    if (visited.has(uuid)) return
    visited.add(uuid)
    stack.add(uuid)
    const refs = graph.get(uuid) ?? []
    for (const ref of refs) {
      dfs(ref, [...path, uuid])
    }
    stack.delete(uuid)
  }

  for (const uuid of graph.keys()) {
    if (!visited.has(uuid)) dfs(uuid, [])
  }

  return cycles
}

// ── R1459: 씬 메타데이터 추출 ─────────────────────────────────────────────

export interface CCSceneMeta {
  version: '2x' | '3x'
  canvasSize: { width: number; height: number }
  nodeCount: number
  scriptUuids: string[]
  textureUuids: string[]
  audioUuids: string[]
  hasPhysics: boolean
  hasTween: boolean
  hasAnimation: boolean
}

/**
 * R1459: 씬 파일에서 메타데이터 추출
 * - 스크립트/텍스처/오디오 UUID, 물리/트윈/애니메이션 존재 여부
 */
export function extractSceneMeta(sceneFile: CCSceneFile): CCSceneMeta {
  const raw = sceneFile._raw as RawEntry[] | undefined
  const version = sceneFile.projectInfo?.version ?? '2x'
  const designRes = getDesignResolution(sceneFile)

  // 노드 수 카운트
  let nodeCount = 0
  function countNodes(node: CCSceneNode): void {
    nodeCount++
    for (const child of node.children) countNodes(child)
  }
  countNodes(sceneFile.root)

  const scriptUuids = new Set<string>()
  const textureUuids = new Set<string>()
  const audioUuids = new Set<string>()
  let hasPhysics = false
  let hasTween = false
  let hasAnimation = false

  const PHYSICS_TYPES = ['cc.RigidBody', 'cc.RigidBody2D', 'cc.BoxCollider', 'cc.CircleCollider', 'cc.PolygonCollider', 'cc.BoxCollider2D', 'cc.CircleCollider2D', 'cc.RigidBody3D', 'cc.Collider', 'cc.Collider2D', 'cc.PhysicsCollider']
  const ANIM_TYPES = ['cc.Animation', 'cc.AnimationComponent', 'cc.SkeletalAnimation', 'cc.Skeleton']

  if (raw) {
    for (const entry of raw) {
      const type = (entry.__type__ as string) ?? ''

      // 물리 컴포넌트 감지
      if (PHYSICS_TYPES.includes(type)) hasPhysics = true

      // 애니메이션 컴포넌트 감지
      if (ANIM_TYPES.includes(type)) hasAnimation = true

      // 커스텀 스크립트 감지 (cc. 접두사가 아닌 __type__)
      if (type && !type.startsWith('cc.') && type !== 'cc.Prefab' && !type.startsWith('_')) {
        // UUID 형태 여부 체크 (스크립트 컴포넌트는 UUID를 __type__으로 사용)
        if (/^[0-9a-f]{8,}/.test(type) || type.includes('$')) {
          scriptUuids.add(type)
        }
      }

      // __uuid__ 참조에서 텍스처/오디오 추출
      extractAssetUuids(entry, textureUuids, audioUuids)

      // cc.Tween 감지 (3.x)
      if (type === 'cc.Tween' || type === 'cc.TweenSystem') hasTween = true
    }
  }

  // 노드 트리에서 추가 감지
  function walkMeta(node: CCSceneNode): void {
    for (const comp of node.components) {
      if (PHYSICS_TYPES.includes(comp.type)) hasPhysics = true
      if (ANIM_TYPES.includes(comp.type)) hasAnimation = true
      if (comp.type && !comp.type.startsWith('cc.')) {
        if (/^[0-9a-f]{8,}/.test(comp.type) || comp.type.includes('$')) {
          scriptUuids.add(comp.type)
        }
      }
    }
    for (const child of node.children) walkMeta(child)
  }
  walkMeta(sceneFile.root)

  return {
    version,
    canvasSize: designRes,
    nodeCount,
    scriptUuids: [...scriptUuids],
    textureUuids: [...textureUuids],
    audioUuids: [...audioUuids],
    hasPhysics,
    hasTween,
    hasAnimation,
  }
}

// ── R1465: 씬 diff ─────────────────────────────────────────────────────────

export interface SceneDiff {
  uuid: string
  nodeName: string
  type: 'added' | 'removed' | 'modified'
  changedFields: string[]
}

/**
 * R1465: 두 씬 상태를 비교하여 차이 목록 반환
 * - added: after에만 존재하는 노드
 * - removed: before에만 존재하는 노드
 * - modified: 양쪽 모두 존재하지만 필드가 다른 노드
 */
export function diffScenes(
  before: CCSceneNode,
  after: CCSceneNode
): SceneDiff[] {
  const diffs: SceneDiff[] = []
  const beforeMap = new Map<string, CCSceneNode>()
  const afterMap = new Map<string, CCSceneNode>()

  function collectNodes(node: CCSceneNode, map: Map<string, CCSceneNode>): void {
    map.set(node.uuid, node)
    for (const child of node.children) collectNodes(child, map)
  }

  collectNodes(before, beforeMap)
  collectNodes(after, afterMap)

  // removed: in before but not in after
  for (const [uuid, node] of beforeMap) {
    if (!afterMap.has(uuid)) {
      diffs.push({ uuid, nodeName: node.name, type: 'removed', changedFields: [] })
    }
  }

  // added or modified
  for (const [uuid, aNode] of afterMap) {
    const bNode = beforeMap.get(uuid)
    if (!bNode) {
      diffs.push({ uuid, nodeName: aNode.name, type: 'added', changedFields: [] })
      continue
    }
    // compare fields
    const changedFields: string[] = []
    if (bNode.name !== aNode.name) changedFields.push('name')
    if (bNode.active !== aNode.active) changedFields.push('active')
    if (bNode.opacity !== aNode.opacity) changedFields.push('opacity')
    // position
    if (bNode.position.x !== aNode.position.x || bNode.position.y !== aNode.position.y || bNode.position.z !== aNode.position.z) changedFields.push('position')
    // scale
    if (bNode.scale.x !== aNode.scale.x || bNode.scale.y !== aNode.scale.y || bNode.scale.z !== aNode.scale.z) changedFields.push('scale')
    // size
    if (bNode.size.x !== aNode.size.x || bNode.size.y !== aNode.size.y) changedFields.push('size')
    // anchor
    if (bNode.anchor.x !== aNode.anchor.x || bNode.anchor.y !== aNode.anchor.y) changedFields.push('anchor')
    // rotation
    if (typeof bNode.rotation !== typeof aNode.rotation ||
        (typeof bNode.rotation === 'number'
          ? bNode.rotation !== aNode.rotation
          : Math.abs((bNode.rotation as {z?:number}).z ?? 0) - Math.abs((aNode.rotation as {z?:number}).z ?? 0) > 0.001)
    ) changedFields.push('rotation')
    // color
    if (bNode.color.r !== aNode.color.r || bNode.color.g !== aNode.color.g || bNode.color.b !== aNode.color.b || bNode.color.a !== aNode.color.a) changedFields.push('color')
    // components count
    if (bNode.components.length !== aNode.components.length) changedFields.push('components')
    else if (bNode.components.some((c, i) => c.type !== aNode.components[i].type)) changedFields.push('components')
    // children count
    if (bNode.children.length !== aNode.children.length) changedFields.push('children')

    if (changedFields.length > 0) {
      diffs.push({ uuid, nodeName: aNode.name, type: 'modified', changedFields })
    }
  }

  return diffs
}

function extractAssetUuids(obj: unknown, textures: Set<string>, audios: Set<string>): void {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) extractAssetUuids(item, textures, audios)
    return
  }
  const record = obj as Record<string, unknown>
  // spriteFrame / texture 참조
  if (typeof record.__uuid__ === 'string') {
    const uuid = record.__uuid__
    // 간단한 휴리스틱: 키 이름으로 구분
    textures.add(uuid)
  }
  // 오디오 필드 패턴 (_clip, _audioClip, audioClip)
  for (const [key, val] of Object.entries(record)) {
    if ((key === '_clip' || key === '_audioClip' || key === 'audioClip' || key === 'clip') && val && typeof val === 'object') {
      const ref = val as Record<string, unknown>
      if (typeof ref.__uuid__ === 'string') {
        audios.add(ref.__uuid__)
      }
    }
    if (key === '_spriteFrame' || key === 'spriteFrame' || key === '_texture' || key === 'texture') {
      if (val && typeof val === 'object') {
        const ref = val as Record<string, unknown>
        if (typeof ref.__uuid__ === 'string') textures.add(ref.__uuid__)
      }
    }
  }
}

// R1478: 대형 씬 청크 스트리밍 파싱
// 씬 파일을 한 번에 파싱하되, 지정 노드 수(chunkSize) 초과 시 partial 노드 트리를 반환하고
// nextChunk 콜백으로 이어서 로드하는 레이지 파싱 패턴

export interface CCSceneStreamState {
  done: boolean
  /** 현재까지 파싱된 최상위 자식 노드 수 */
  parsedTopChildren: number
  totalTopChildren: number
  /** 전체 raw 배열 길이 (대형 씬 크기 판단) */
  rawLength: number
}

/**
 * 대형 씬 파싱 — 즉시 메타 정보 반환 (rawLength, topChildren 수)
 * 실제 파싱은 sync이지만 청크 단위로 루트 자식을 잘라서 반환.
 * chunkSize: 최상위 자식 노드 최대 파싱 수 (기본 50, 0 = 전체)
 */
export async function parseCCSceneChunked(
  scenePath: string,
  projectInfo: CCFileProjectInfo,
  chunkSize = 50,
  chunkOffset = 0
): Promise<{ scene: CCSceneFile; state: CCSceneStreamState }> {
  let raw: RawEntry[]
  try {
    raw = JSON.parse(fs.readFileSync(scenePath, 'utf-8')) as RawEntry[]
  } catch (e) {
    throw new Error(`씬 파일 파싱 실패: ${e instanceof Error ? e.message : String(e)}`)
  }
  const version = projectInfo.version ?? detectVersionFromRaw(raw)
  const rootIdx = resolveRootIdx(raw)
  if (rootIdx < 0) throw new Error(`씬 루트 노드를 찾을 수 없습니다: ${scenePath}`)

  // 전체 파싱
  const root =
    version === '2x'
      ? parseNode2x(raw, rootIdx)
      : parseNode3x(raw, rootIdx, buildUiTransformMap(raw))
  if (!root) throw new Error(`루트 노드 파싱 실패: ${scenePath}`)

  // 커스텀 스크립트 UUID → 파일명 해결 + scriptNames (인스펙터 표시용)
  const scriptNamesChunked: Record<string, string> = {}
  if (projectInfo.assetsDir) {
    const uuidMap = await buildUUIDMap(projectInfo.assetsDir)
    const scriptUuidToName = new Map<string, string>()
    for (const [uuid, meta] of uuidMap) {
      if (meta.type === 'script') {
        const name = meta.relPath.split('/').pop()?.replace(/\.(ts|js)$/, '') ?? uuid
        scriptUuidToName.set(uuid, name)
        scriptNamesChunked[uuid] = name
      }
    }
    if (scriptUuidToName.size > 0) {
      function resolveCompTypesChunked(node: CCSceneNode) {
        for (const comp of node.components) {
          if (!comp.type.includes('.')) {
            const resolved = scriptUuidToName.get(comp.type)
            if (resolved) (comp as CCSceneComponent).type = resolved
          }
        }
        node.children.forEach(resolveCompTypesChunked)
      }
      resolveCompTypesChunked(root)
    }
  }

  const totalTopChildren = root.children.length
  const rawLength = raw.length
  const parsedTopChildren = Math.min(chunkOffset + chunkSize, totalTopChildren)

  // 청크 슬라이싱 (chunkSize > 0이면 자식 일부만 반환)
  const chunkedRoot: CCSceneNode =
    chunkSize > 0
      ? { ...root, children: root.children.slice(chunkOffset, chunkOffset + chunkSize) }
      : root

  return {
    scene: { projectInfo, scenePath, root: chunkedRoot, _raw: raw, scriptNames: scriptNamesChunked },
    state: {
      done: parsedTopChildren >= totalTopChildren,
      parsedTopChildren,
      totalTopChildren,
      rawLength,
    },
  }
}

/**
 * 대형 씬 여부 판단 (rawLength > 500이면 대형 씬으로 간주)
 */
export function isLargeScene(scenePath: string): boolean {
  try {
    const raw = JSON.parse(fs.readFileSync(scenePath, 'utf-8')) as unknown[]
    return raw.length > 500
  } catch {
    return false
  }
}
