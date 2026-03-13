import fs from 'fs'
import path from 'path'
import type { CCSceneNode, CCSceneFile, CCVec3 } from '../../shared/ipc-schema'

type RawEntry = Record<string, unknown>

export interface SaveResult {
  success: boolean
  backupPath?: string
  error?: string
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

  patchNode(modifiedRoot)

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

    return { success: true, backupPath }
  } catch (e) {
    return { success: false, error: String(e) }
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
