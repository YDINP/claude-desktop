import fs from 'fs'
import path from 'path'

export interface AssetMeta {
  uuid: string
  path: string       // absolute path to the asset file
  relPath: string    // relative to assetsDir
  type: AssetType
}

export type AssetType =
  | 'texture' | 'sprite-atlas' | 'prefab' | 'scene' | 'script'
  | 'audio' | 'font' | 'animation' | 'material' | 'json' | 'text' | 'unknown'

/** UUID → AssetMeta lookup */
export type UUIDMap = Map<string, AssetMeta>

/**
 * CC 에셋 리졸버 (Phase B)
 * .meta 파일 전수 스캔 → UUID → 에셋 경로 맵 빌드
 * CC 2.x / 3.x 모두 동일한 .meta JSON 포맷 사용
 */
export function buildUUIDMap(assetsDir: string): UUIDMap {
  const map = new Map<string, AssetMeta>()
  try {
    walkMeta(assetsDir, assetsDir, map)
    // .meta 없는 .prefab 파일 폴백 스캔
    const pathSet = new Set([...map.values()].map(v => v.path))
    walkPrefabFiles(assetsDir, assetsDir, map, pathSet)
  } catch { /* ignore */ }
  return map
}

function walkPrefabFiles(dir: string, assetsDir: string, map: UUIDMap, pathSet: Set<string>) {
  if (map.size > 10000) return
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (map.size > 10000) break
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      walkPrefabFiles(full, assetsDir, map, pathSet)
    } else if (e.isFile() && e.name.endsWith('.prefab') && !pathSet.has(full)) {
      const relPath = path.relative(assetsDir, full).replace(/\\/g, '/')
      const syntheticUuid = 'nometaprefab-' + Buffer.from(relPath).toString('base64').slice(0, 24)
      map.set(syntheticUuid, { uuid: syntheticUuid, path: full, relPath, type: 'prefab' })
      pathSet.add(full)
    }
  }
}

function walkMeta(dir: string, assetsDir: string, map: UUIDMap) {
  if (map.size > 10000) return  // safety limit
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const e of entries) {
    if (map.size > 10000) break
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      walkMeta(full, assetsDir, map)
    } else if (e.isFile() && e.name.endsWith('.meta')) {
      parseMeta(full, assetsDir, map)
    }
  }
}

function parseMeta(metaPath: string, assetsDir: string, map: UUIDMap) {
  try {
    const raw = fs.readFileSync(metaPath, 'utf-8')
    const meta = JSON.parse(raw)

    // .meta 대응 에셋 경로 (.meta 확장자 제거)
    const assetPath = metaPath.slice(0, -5)  // remove '.meta'
    const relPath = path.relative(assetsDir, assetPath).replace(/\\/g, '/')
    const ext = assetPath.split('.').pop()?.toLowerCase() ?? ''
    const type = extToType(ext, relPath)

    // 메인 UUID
    const uuid = meta.uuid as string | undefined
    if (uuid) {
      map.set(uuid, { uuid, path: assetPath, relPath, type })
    }

    // subMetas (스프라이트 아틀라스 내 서브 텍스처 등)
    const subMetas = meta.subMetas as Record<string, { uuid: string }> | undefined
    if (subMetas) {
      for (const sub of Object.values(subMetas)) {
        if (sub.uuid) {
          map.set(sub.uuid, {
            uuid: sub.uuid,
            path: assetPath,
            relPath,
            type: 'texture',
          })
        }
      }
    }
  } catch { /* ignore malformed .meta */ }
}

function extToType(ext: string, relPath: string): AssetType {
  switch (ext) {
    case 'png': case 'jpg': case 'jpeg': case 'webp': case 'gif': case 'bmp': case 'tga':
      if (relPath.endsWith('.atlas') || relPath.includes('atlas')) return 'sprite-atlas'
      return 'texture'
    case 'prefab': return 'prefab'
    case 'fire': case 'scene': return 'scene'
    case 'ts': case 'js': return 'script'
    case 'mp3': case 'ogg': case 'wav': case 'm4a': return 'audio'
    case 'ttf': case 'otf': case 'fnt': return 'font'
    case 'anim': return 'animation'
    case 'mtl': return 'material'
    case 'json': return 'json'
    case 'txt': case 'md': return 'text'
    default: return 'unknown'
  }
}

/**
 * 씬/프리팹 raw 배열에서 참조된 UUID 목록 추출
 * cc.Sprite.spriteFrame, cc.Button.clickEvents 등의 uuid 필드 재귀 탐색
 */
export function extractReferencedUUIDs(raw: unknown[]): string[] {
  const uuids = new Set<string>()
  collectUUIDs(raw, uuids)
  return Array.from(uuids)
}

function collectUUIDs(obj: unknown, acc: Set<string>) {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) collectUUIDs(item, acc)
    return
  }
  const o = obj as Record<string, unknown>
  if (o.__uuid__ && typeof o.__uuid__ === 'string') {
    acc.add(o.__uuid__)
  }
  for (const v of Object.values(o)) collectUUIDs(v, acc)
}

/**
 * R1410: UUID → 파일 경로 resolve (모든 에셋 타입)
 */
export function resolveUUIDToPath(uuid: string, uuidMap: UUIDMap): string | null {
  return uuidMap.get(uuid)?.path ?? null
}

/**
 * R1410: UUID → 에셋 상세 정보 (path + type + name)
 * displayName: .meta 파일의 displayName 또는 파일명에서 추출
 */
export function getAssetInfo(uuid: string, uuidMap: UUIDMap): { path: string; type: string; name: string } | null {
  const asset = uuidMap.get(uuid)
  if (!asset) return null
  const name = path.basename(asset.path, path.extname(asset.path))
  return { path: asset.path, type: asset.type, name }
}

/**
 * R1410: 이미지 에셋 UUID 목록 반환
 */
export function getAllTextureUUIDs(uuidMap: UUIDMap): string[] {
  const result: string[] = []
  for (const [uuid, asset] of uuidMap) {
    if (asset.type === 'texture' || asset.type === 'sprite-atlas') {
      result.push(uuid)
    }
  }
  return result
}

/**
 * UUID 맵 기반으로 텍스처 경로 resolve
 * local:// 프로토콜 URL 반환 (Electron protocol.handle 대응)
 */
export function resolveTextureUrl(uuid: string, uuidMap: UUIDMap): string | null {
  const asset = uuidMap.get(uuid)
  if (!asset) return null
  if (asset.type !== 'texture' && asset.type !== 'sprite-atlas') return null
  // Electron local:// 프로토콜 사용 (index.ts에 등록된 'local' scheme)
  return `local://?path=${encodeURIComponent(asset.path)}`
}
