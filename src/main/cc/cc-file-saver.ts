import fs from 'fs'
import path from 'path'
import type { CCSceneNode, CCSceneFile, CCVec3 } from '../../shared/ipc-schema'

type RawEntry = Record<string, unknown>

export interface SaveResult {
  success: boolean
  backupPath?: string
  error?: string
  conflict?: boolean   // R1437: 외부 변경 감지 시 true
  currentMtime?: number // R1437: 저장 후 mtime 반환
}

// R1437: 로드 시 mtime 기록 맵 (scenePath → mtimeMs)
const loadedMtimeMap = new Map<string, number>()

/** R1437: 씬 로드 시 mtime 기록 */
export function recordSceneMtime(scenePath: string): void {
  try {
    const stat = fs.statSync(scenePath)
    loadedMtimeMap.set(scenePath, stat.mtimeMs)
  } catch { /* ignore */ }
}

/** R1437: 강제 덮어쓰기 — mtime 무시하고 저장 */
export function forceOverwriteScene(sceneFile: CCSceneFile, modifiedRoot: CCSceneNode): SaveResult {
  // mtime 기록 초기화 후 저장
  loadedMtimeMap.delete(sceneFile.scenePath)
  return saveCCScene(sceneFile, modifiedRoot)
}

/**
 * 수정된 CCSceneNode 트리를 원본 flat 배열(_raw)에 패치 후 파일로 저장
 * - 저장 전 .bak 백업 생성
 * - temp → rename 패턴으로 원자적 저장
 */
export function saveCCScene(sceneFile: CCSceneFile, modifiedRoot: CCSceneNode): SaveResult {
  if (!sceneFile._raw) {
    return { success: false, error: '_raw 원본 배열이 없습니다. 씬을 다시 로드하세요.' }
  }

  const { scenePath, projectInfo } = sceneFile
  const version = projectInfo.version ?? '2x'

  // 원본 배열 딥복사
  const raw: RawEntry[] = JSON.parse(JSON.stringify(sceneFile._raw))

  // UITransform 인덱스 맵 빌드 (3x 전용)
  const uiTransformByNodeIdx = new Map<number, number>()
  if (version === '3x') {
    raw.forEach((e, i) => {
      if (e.__type__ === 'cc.UITransform') {
        const nodeRef = e.node as { __id__?: number } | undefined
        if (nodeRef?.__id__ != null) uiTransformByNodeIdx.set(nodeRef.__id__, i)
      }
    })
  }

  // R1504: 새 노드(_rawIndex==null) → raw 배열에 항목 추가 (정규화)
  // R2459: 새 컴포넌트(_rawIndex==null) → raw 배열에 항목 추가
  function normalizeTree(node: CCSceneNode, parentRawIdx: number | null): CCSceneNode {
    let cur = node
    if (cur._rawIndex == null) {
      const newIdx = raw.length
      raw.push(version === '2x'
        ? buildNewRawNode2x(cur, parentRawIdx)
        : buildNewRawNode3x(cur, parentRawIdx))
      cur = { ...cur, _rawIndex: newIdx }
    }
    // R2459: 새 컴포넌트 정규화 (rawIndex 없는 컴포넌트 → raw 배열에 추가)
    const normalizedComps = cur.components.map(comp => {
      if (comp._rawIndex != null) return comp
      const compIdx = raw.length
      raw.push(version === '2x'
        ? buildNewRawComp2x(comp.type, cur._rawIndex!)
        : buildNewRawComp3x(comp.type, cur._rawIndex!))
      return { ...comp, _rawIndex: compIdx }
    })
    cur = { ...cur, components: normalizedComps }
    const children = cur.children.map(c => normalizeTree(c, cur._rawIndex!))
    return { ...cur, children }
  }
  const normalizedRoot = normalizeTree(modifiedRoot, null)

  // R1502: 저장 전 유효성 검사
  const validation = validateCCScene(normalizedRoot)
  if (!validation.valid) {
    return { success: false, error: `유효성 오류: ${validation.errors.join('; ')}` }
  }
  if (validation.warnings.length > 0) {
    console.warn('[cc-file-saver] 저장 경고:', validation.warnings.join(', '))
  }

  // CCSceneNode 트리 → raw 배열 패치
  function patchNode(node: CCSceneNode) {
    const idx = node._rawIndex
    if (idx == null || idx < 0 || idx >= raw.length) return
    const e = raw[idx]

    e._name = node.name
    e._active = node.active

    if (version === '2x') {
      patch2x(e, node)
    } else {
      patch3x(e, node, raw, uiTransformByNodeIdx)
    }

    // _children 동기화 — 트리에서 삭제된 노드를 raw에서도 제거
    if (Array.isArray(e._children) || node.children.length > 0) {
      e._children = node.children
        .filter(c => c._rawIndex != null)
        .map(c => ({ __id__: c._rawIndex! }))
    }

    // R2459: _components 동기화 — 새 컴포넌트 포함
    const compRefs = node.components.filter(c => c._rawIndex != null).map(c => ({ __id__: c._rawIndex! }))
    if (compRefs.length > 0 || Array.isArray(e._components)) {
      e._components = compRefs
    }

    // 컴포넌트 props 패치 (Label 텍스트 등)
    for (const comp of node.components) {
      if (comp._rawIndex == null) continue
      const ce = raw[comp._rawIndex]
      if (!ce) continue
      for (const [propKey, propVal] of Object.entries(comp.props)) {
        if (version === '2x') {
          // 2x: _N$key or _key
          const nKey = '_N$' + propKey
          const uKey = '_' + propKey
          if (nKey in ce) ce[nKey] = propVal
          else if (uKey in ce) ce[uKey] = propVal
          else if (propKey in ce) ce[propKey] = propVal
        } else {
          // 3x: _key
          const uKey = '_' + propKey
          if (uKey in ce) ce[uKey] = propVal
          else if (propKey in ce) ce[propKey] = propVal
        }
      }
    }

    for (const child of node.children) patchNode(child)
  }

  patchNode(normalizedRoot)

  // ── R1437: 충돌 감지 (mtime 비교) ──────────────────────────────────────────
  const recordedMtime = loadedMtimeMap.get(scenePath)
  if (recordedMtime != null) {
    try {
      const currentStat = fs.statSync(scenePath)
      if (Math.abs(currentStat.mtimeMs - recordedMtime) > 100) {
        return { success: false, conflict: true, error: '파일이 외부에서 변경되었습니다.', currentMtime: currentStat.mtimeMs }
      }
    } catch { /* file may be deleted — proceed with save */ }
  }

  // ── 파일 저장 ────────────────────────────────────────────────────────────────
  try {
    // .bak 백업
    const backupPath = scenePath + '.bak'
    fs.copyFileSync(scenePath, backupPath)

    // temp 파일로 먼저 쓰고 rename (원자적)
    const tmpPath = scenePath + '.tmp'
    const content = JSON.stringify(raw, null, 2)
    fs.writeFileSync(tmpPath, content, 'utf-8')
    fs.renameSync(tmpPath, scenePath)

    // R1437: 저장 후 mtime 갱신
    try {
      const newStat = fs.statSync(scenePath)
      loadedMtimeMap.set(scenePath, newStat.mtimeMs)
    } catch { /* ignore */ }

    return { success: true, backupPath }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ── R1504: 새 노드 raw entry 빌드 ─────────────────────────────────────────────

function buildNewRawNode2x(node: CCSceneNode, parentIdx: number | null): RawEntry {
  const pos = node.position ?? { x: 0, y: 0, z: 0 }
  const sc = node.scale ?? { x: 1, y: 1, z: 1 }
  return {
    __type__: 'cc.Node',
    _name: node.name,
    _objFlags: 0,
    _parent: parentIdx != null ? { __id__: parentIdx } : null,
    _children: [],
    _active: node.active ?? true,
    _components: [],
    _prefab: null,
    _trs: {
      __type__: 'TypedArray',
      ctor: 'Float64Array',
      array: [pos.x ?? 0, pos.y ?? 0, pos.z ?? 0, 0, 0, 0, 1, sc.x ?? 1, sc.y ?? 1, sc.z ?? 1],
    },
    _contentSize: { width: node.size?.x ?? 100, height: node.size?.y ?? 100 },
    _anchorPoint: { x: node.anchor?.x ?? 0.5, y: node.anchor?.y ?? 0.5 },
    _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 },
    _opacity: node.opacity ?? 255,
    _skewX: 0,
    _skewY: 0,
    _zIndex: 0,
    groupIndex: 0,
    id: node.uuid,
  }
}

function buildNewRawNode3x(node: CCSceneNode, parentIdx: number | null): RawEntry {
  const pos = node.position ?? { x: 0, y: 0, z: 0 }
  const sc = node.scale ?? { x: 1, y: 1, z: 1 }
  return {
    __type__: 'cc.Node',
    _name: node.name,
    _objFlags: 0,
    '__editorExtras__': {},
    _parent: parentIdx != null ? { __id__: parentIdx } : null,
    _children: [],
    _active: node.active ?? true,
    _components: [],
    _prefab: null,
    _lpos: { x: pos.x ?? 0, y: pos.y ?? 0, z: pos.z ?? 0 },
    _lrot: { x: 0, y: 0, z: 0, w: 1 },
    _lscale: { x: sc.x ?? 1, y: sc.y ?? 1, z: sc.z ?? 1 },
    _euler: { x: 0, y: 0, z: 0 },
    _uiProps: { _localOpacity: (node.opacity ?? 255) / 255 },
    _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 },
    layer: 33554432,
  }
}

// ── R2459: 새 컴포넌트 raw entry 빌드 ─────────────────────────────────────────
// R2462: 타입별 기본 필드 추가 (Inspector 즉시 편집 가능하도록)

/** CC 2.x 컴포넌트 타입별 기본 필드 맵 (_N$ 접두사 포함) */
const COMP_DEFAULT_2x: Record<string, Record<string, unknown>> = {
  'cc.Label':       { '_N$string': '', '_N$horizontalAlign': 1, '_N$fontSize': 40, '_N$lineHeight': 40, '_N$enableWrapText': true },
  'cc.RichText':    { '_N$string': '', '_N$fontSize': 40, '_N$maxWidth': 0 },
  'cc.Sprite':      { '_N$type': 0, '_N$sizeMode': 1, '_N$fillType': 0, '_N$fillRange': 1 },
  'cc.Button':      { '_N$interactable': true, '_N$enableAutoGrayEffect': false, '_N$transition': 1 },
  'cc.Toggle':      { '_N$isChecked': false },
  'cc.Slider':      { '_N$progress': 0, '_N$direction': 0 },
  'cc.ProgressBar': { '_N$progress': 0.5, '_N$mode': 0, '_N$reverse': false },
  'cc.ScrollView':  { '_N$horizontal': false, '_N$vertical': true, '_N$inertia': true, '_N$brake': 0.75 },
  'cc.EditBox':     { '_N$string': '', '_N$maxLength': 20, '_N$inputMode': 0, '_N$inputFlag': 3 },
  'cc.Layout':      { '_N$type': 0, '_N$resizeMode': 0, '_N$paddingLeft': 0, '_N$paddingRight': 0, '_N$paddingTop': 0, '_N$paddingBottom': 0, '_N$spacingX': 0, '_N$spacingY': 0 },
  'cc.Widget':      { '_N$isAlignTop': false, '_N$isAlignBottom': false, '_N$isAlignLeft': false, '_N$isAlignRight': false, '_N$isAbsTop': true, '_N$isAbsBottom': true, '_N$isAbsLeft': true, '_N$isAbsRight': true, '_N$top': 0, '_N$bottom': 0, '_N$left': 0, '_N$right': 0 },
  'cc.Animation':   { '_N$defaultClip': null, '_N$clips': [], '_N$playOnLoad': false },
  'cc.AudioSource': { '_N$clip': null, '_N$volume': 1, '_N$loop': false, '_N$playOnLoad': false },
  'cc.Mask':        { '_N$type': 0, '_N$inverted': false },
  'cc.Graphics':    { '_N$lineWidth': 2, '_N$strokeColor': { '__type__': 'cc.Color', r: 255, g: 255, b: 255, a: 255 } },
}

/** CC 3.x 컴포넌트 타입별 기본 필드 맵 (언더스코어 접두사) */
const COMP_DEFAULT_3x: Record<string, Record<string, unknown>> = {
  'cc.Label':       { '_string': '', '_horizontalAlign': 1, '_fontSize': 40, '_lineHeight': 40, '_enableWrapText': true },
  'cc.RichText':    { '_string': '', '_fontSize': 40, '_maxWidth': 0 },
  'cc.Sprite':      { '_type': 0, '_sizeMode': 1, '_fillType': 0, '_fillRange': 1 },
  'cc.Button':      { '_interactable': true, '_enableAutoGrayEffect': false, '_transition': 1 },
  'cc.Toggle':      { '_isChecked': false },
  'cc.Slider':      { '_progress': 0, '_direction': 0 },
  'cc.ProgressBar': { '_progress': 0.5, '_mode': 0, '_reverse': false },
  'cc.ScrollView':  { '_horizontal': false, '_vertical': true, '_inertia': true, '_brake': 0.75 },
  'cc.EditBox':     { '_string': '', '_maxLength': 20, '_inputMode': 0, '_inputFlag': 3 },
  'cc.Layout':      { '_type': 0, '_resizeMode': 0, '_paddingLeft': 0, '_paddingRight': 0, '_paddingTop': 0, '_paddingBottom': 0, '_spacingX': 0, '_spacingY': 0 },
  'cc.Widget':      { '_isAlignTop': false, '_isAlignBottom': false, '_isAlignLeft': false, '_isAlignRight': false, '_isAbsTop': true, '_isAbsBottom': true, '_isAbsLeft': true, '_isAbsRight': true, '_top': 0, '_bottom': 0, '_left': 0, '_right': 0 },
  'cc.Animation':   { '_defaultClip': null, '_clips': [], '_playOnLoad': false },
  'cc.AudioSource': { '_clip': null, '_volume': 1, '_loop': false, '_playOnLoad': false },
  'cc.Mask':        { '_type': 0, '_inverted': false },
  'cc.Graphics':    { '_lineWidth': 2, '_strokeColor': { '__type__': 'cc.Color', r: 255, g: 255, b: 255, a: 255 } },
}

function buildNewRawComp2x(type: string, nodeIdx: number): RawEntry {
  return {
    __type__: type,
    _name: '',
    _objFlags: 0,
    node: { __id__: nodeIdx },
    _enabled: true,
    ...(COMP_DEFAULT_2x[type] ?? {}),
  }
}

function buildNewRawComp3x(type: string, nodeIdx: number): RawEntry {
  return {
    __type__: type,
    _name: '',
    _objFlags: 0,
    '__editorExtras__': {},
    node: { __id__: nodeIdx },
    _enabled: true,
    ...(COMP_DEFAULT_3x[type] ?? {}),
  }
}

// ── CC 2.x 패치 ───────────────────────────────────────────────────────────────

function patch2x(e: RawEntry, node: CCSceneNode) {
  // _trs TypedArray 패치
  const trs = e._trs as RawEntry | undefined
  if (trs && trs.__type__ === 'TypedArray' && Array.isArray(trs.array)) {
    const a = trs.array as number[]
    const pos = node.position as CCVec3
    a[0] = pos.x ?? 0
    a[1] = pos.y ?? 0
    a[2] = pos.z ?? 0

    // rotation: 2x stores as Z-euler number
    const rotZ = typeof node.rotation === 'number' ? node.rotation : (node.rotation as CCVec3).z ?? 0
    const rad = rotZ * Math.PI / 180
    // euler Z → quaternion (2D: only Z axis)
    a[3] = 0          // qx
    a[4] = 0          // qy
    a[5] = Math.sin(rad / 2)  // qz
    a[6] = Math.cos(rad / 2)  // qw

    const sc = node.scale as CCVec3
    a[7] = sc.x ?? 1
    a[8] = sc.y ?? 1
    a[9] = sc.z ?? 1
  }

  // _contentSize
  e._contentSize = { width: node.size.x, height: node.size.y }

  // _anchorPoint
  e._anchorPoint = { x: node.anchor.x, y: node.anchor.y }

  // _opacity
  e._opacity = node.opacity

  // _color
  e._color = { r: node.color.r, g: node.color.g, b: node.color.b, a: node.color.a }

  // R1532: _tag 패치
  if (node.tag != null) e._tag = node.tag
}

// ── CC 3.x 패치 ───────────────────────────────────────────────────────────────

function patch3x(
  e: RawEntry,
  node: CCSceneNode,
  raw: RawEntry[],
  uiMap: Map<number, number>
) {
  const pos = node.position as CCVec3
  const sc = node.scale as CCVec3

  e._lpos = { x: pos.x ?? 0, y: pos.y ?? 0, z: pos.z ?? 0 }

  // rotation: 3x stores euler {x,y,z}
  if (typeof node.rotation === 'object' && node.rotation !== null) {
    e._lrot = { x: (node.rotation as CCVec3).x ?? 0, y: (node.rotation as CCVec3).y ?? 0, z: (node.rotation as CCVec3).z ?? 0 }
  } else {
    e._lrot = { x: 0, y: 0, z: typeof node.rotation === 'number' ? node.rotation : 0 }
  }

  e._lscale = { x: sc.x ?? 1, y: sc.y ?? 1, z: sc.z ?? 1 }

  // _color
  e._color = { r: node.color.r, g: node.color.g, b: node.color.b, a: node.color.a }

  // _uiProps opacity (0~1 range)
  const uiProps = (e._uiProps as RawEntry | undefined) ?? {}
  uiProps._localOpacity = node.opacity / 255
  e._uiProps = uiProps

  // UITransform: size + anchor
  const idx = node._rawIndex
  if (idx != null) {
    const uiIdx = uiMap.get(idx)
    if (uiIdx != null && uiIdx < raw.length) {
      const ui = raw[uiIdx]
      ui._contentSize = { width: node.size.x, height: node.size.y }
      ui._anchorPoint = { x: node.anchor.x, y: node.anchor.y }
    }
  }

  // R1532: layer 패치
  if (node.layer != null) e.layer = node.layer
}

// ── R1502: 저장 전 유효성 검사 ────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  warnings: string[]
  errors: string[]
}

/** 순환 참조 + 중복 UUID + rawIndex null 감지 */
export function validateCCScene(root: CCSceneNode): ValidationResult {
  const warnings: string[] = []
  const errors: string[] = []
  const allUuids = new Set<string>()
  const pathStack = new Set<string>()

  function traverse(node: CCSceneNode) {
    // 순환 참조 감지 (조상 체인에 동일 uuid 존재)
    if (pathStack.has(node.uuid)) {
      errors.push(`순환 참조: uuid=${node.uuid} name="${node.name}"`)
      return
    }
    // 중복 UUID 감지
    if (allUuids.has(node.uuid)) {
      errors.push(`중복 UUID: uuid=${node.uuid} name="${node.name}"`)
    } else {
      allUuids.add(node.uuid)
    }
    // _rawIndex null 경고
    if (node._rawIndex == null) {
      warnings.push(`_rawIndex 없음: "${node.name}" — 저장 시 무시됩니다`)
    }

    pathStack.add(node.uuid)
    for (const child of node.children) traverse(child)
    pathStack.delete(node.uuid)
  }

  traverse(root)
  return { valid: errors.length === 0, warnings, errors }
}

// R1423: 씬 디렉토리의 .bak 파일 목록 반환
export interface BakFileInfo {
  name: string
  path: string
  size: number
  mtime: number
}

export function listBakFiles(scenePath: string): BakFileInfo[] {
  const dir = path.dirname(scenePath)
  const baseName = path.basename(scenePath)
  try {
    const entries = fs.readdirSync(dir)
    return entries
      .filter(e => e.startsWith(baseName) && e.endsWith('.bak'))
      .map(name => {
        const fullPath = path.join(dir, name)
        try {
          const stat = fs.statSync(fullPath)
          return { name, path: fullPath, size: stat.size, mtime: stat.mtimeMs }
        } catch { return null }
      })
      .filter((v): v is BakFileInfo => v !== null)
      .sort((a, b) => b.mtime - a.mtime)
  } catch { return [] }
}

// R1423: .bak 파일 전체 삭제
export function deleteAllBakFiles(scenePath: string): { deleted: number; error?: string } {
  const baks = listBakFiles(scenePath)
  let deleted = 0
  for (const bak of baks) {
    try { fs.unlinkSync(bak.path); deleted++ } catch { /* ignore */ }
  }
  return { deleted }
}

// R1423: 특정 .bak 파일에서 복원
export function restoreFromBakFile(bakPath: string, scenePath: string): { success: boolean; error?: string } {
  if (!fs.existsSync(bakPath)) return { success: false, error: '백업 파일이 존재하지 않습니다.' }
  try {
    fs.copyFileSync(bakPath, scenePath)
    return { success: true }
  } catch (e) { return { success: false, error: String(e) } }
}

/**
 * 백업 파일 복원 (저장 실패 시 롤백용)
 */
export function restoreFromBackup(scenePath: string): { success: boolean; error?: string } {
  const backupPath = scenePath + '.bak'
  if (!fs.existsSync(backupPath)) {
    return { success: false, error: '백업 파일이 없습니다.' }
  }
  try {
    fs.copyFileSync(backupPath, scenePath)
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
