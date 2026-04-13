import { ipcMain, dialog, BrowserWindow } from 'electron'
import http from 'http'
import { readFile } from 'fs/promises'
import { detectCCVersion } from '../cc/cc-version-detector'
import { parseCCScene, parseCCSceneChunked, isLargeScene } from '../cc/cc-file-parser'
import { saveCCScene, restoreFromBackup, listBakFiles, deleteAllBakFiles, restoreFromBakFile, recordSceneMtime, forceOverwriteScene, clearMtimeMap } from '../cc/cc-file-saver'
import { ccFileWatcher } from '../cc/cc-file-watcher'
import { buildUUIDMap, extractReferencedUUIDs, resolveTextureUrl, type UUIDMap } from '../cc/cc-asset-resolver'
import {
  CC_FILE_DETECT,
  CC_FILE_OPEN_PROJECT,
  CC_FILE_LIST_SCENES,
  CC_FILE_READ_SCENE,
  CC_FILE_SAVE_SCENE,
  type CCFileProjectInfo,
  type CCSceneFile,
  type CCSceneNode,
} from '../../shared/ipc-schema'

let _registered = false
let _watchUnsubscribe: (() => void) | null = null
let _partialUpdateUnsubscribe: (() => void) | null = null

// per-scenePath 저장 직렬화 큐 — 동시 저장 요청 시 순서 보장
const _saveQueues = new Map<string, Promise<unknown>>()

// UUID 맵 캐시 (assetsDir → map, 30초 TTL) — buildUUIDMap은 디렉토리 전체 스캔이므로 캐싱 필수
const _uuidMapCache = new Map<string, { map: UUIDMap; ts: number }>()
async function getCachedUUIDMap(assetsDir: string): Promise<UUIDMap> {
  const cached = _uuidMapCache.get(assetsDir)
  if (cached && Date.now() - cached.ts < 30000) return cached.map
  const map = await buildUUIDMap(assetsDir)
  _uuidMapCache.set(assetsDir, { map, ts: Date.now() })
  return map
}
// R1438: 씬 공유 로컬 서버
let _sceneServer: http.Server | null = null
let _sceneServerTimer: ReturnType<typeof setTimeout> | null = null

export function registerCCFileHandlers(mainWindow?: BrowserWindow) {
  if (_registered) return
  _registered = true

  // 파일 변경 이벤트 → renderer로 전달
  _watchUnsubscribe = ccFileWatcher.onChange(event => {
    const win = mainWindow ?? BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.webContents.send('cc:file:changed', event)
    }
  })

  // R1389: 부분 업데이트 이벤트 → renderer로 전달
  _partialUpdateUnsubscribe = ccFileWatcher.onPartialUpdate(update => {
    const win = mainWindow ?? BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.webContents.send('cc:scene-partial-update', update)
    }
  })

  /** 경로 기반 CC 버전 감지 */
  ipcMain.handle(CC_FILE_DETECT, async (_e, projectPath: string) => {
    return detectCCVersion(projectPath)
  })

  /** 폴더 선택 다이얼로그 → CC 버전 감지 */
  ipcMain.handle(CC_FILE_OPEN_PROJECT, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Cocos Creator 프로젝트 열기',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    // 프로젝트 전환 시 이전 프로젝트의 mtime/UUID 캐시 클리어
    clearMtimeMap()
    _uuidMapCache.clear()
    return detectCCVersion(result.filePaths[0])
  })

  /** 프로젝트 내 씬 파일 목록 반환 */
  ipcMain.handle(CC_FILE_LIST_SCENES, async (_e, projectPath: string) => {
    const info = detectCCVersion(projectPath)
    return info.scenes ?? []
  })

  /** 씬 파일 파싱 → CCSceneFile 반환 */
  ipcMain.handle(CC_FILE_READ_SCENE, async (
    _e,
    scenePath: string,
    projectInfo: CCFileProjectInfo
  ) => {
    try {
      // assetsDir가 있으면 캐시된 UUID 맵을 미리 확보해서 parseCCScene 내부 재스캔 방지
      const uuidMap = projectInfo.assetsDir ? await getCachedUUIDMap(projectInfo.assetsDir) : undefined
      const result = await parseCCScene(scenePath, projectInfo, uuidMap)
      // R1437: 로드 시 mtime 기록
      recordSceneMtime(scenePath)
      return result
    } catch (e) {
      return { error: String(e) }
    }
  })

  /** 수정된 씬 트리 → 파일 저장 (temp→rename 원자적, .bak 백업) */
  ipcMain.handle(CC_FILE_SAVE_SCENE, (
    _e,
    sceneFile: CCSceneFile,
    modifiedRoot: CCSceneNode
  ) => {
    const scenePath = sceneFile.scenePath
    const prev = _saveQueues.get(scenePath) ?? Promise.resolve()
    const current = prev.then(() => saveCCScene(sceneFile, modifiedRoot)).catch((err) => ({ success: false, error: String(err) }))
    _saveQueues.set(scenePath, current)
    return current
  })

  /** R2327: 다른 이름으로 저장 (Save As) */
  ipcMain.handle('cc:file:saveAs', async (
    _e,
    sceneFile: CCSceneFile,
    modifiedRoot: CCSceneNode
  ) => {
    const win = BrowserWindow.getAllWindows()[0]
    const ext = sceneFile.scenePath.endsWith('.fire') ? 'fire' : 'scene'
    const result = await dialog.showSaveDialog(win, {
      title: '다른 이름으로 저장',
      defaultPath: sceneFile.scenePath,
      filters: [{ name: 'CC Scene', extensions: [ext] }],
    })
    if (result.canceled || !result.filePath) return { success: false, canceled: true }
    const newSceneFile: CCSceneFile = { ...sceneFile, scenePath: result.filePath }
    const saveResult = saveCCScene(newSceneFile, modifiedRoot)
    return { ...saveResult, savedPath: result.filePath }
  })

  /** R1437: 충돌 무시 강제 덮어쓰기 */
  ipcMain.handle('cc:file:forceOverwrite', async (
    _e,
    sceneFile: CCSceneFile,
    modifiedRoot: CCSceneNode
  ) => {
    return forceOverwriteScene(sceneFile, modifiedRoot)
  })

  /** 백업에서 씬 파일 복원 */
  ipcMain.handle('cc:file:restoreBackup', async (_e, scenePath: string) => {
    return restoreFromBackup(scenePath)
  })

  /** R1423: .bak 파일 목록 조회 */
  ipcMain.handle('cc:file:listBakFiles', async (_e, scenePath: string) => {
    return listBakFiles(scenePath)
  })

  /** R1423: .bak 파일 전체 삭제 */
  ipcMain.handle('cc:file:deleteAllBakFiles', async (_e, scenePath: string) => {
    return deleteAllBakFiles(scenePath)
  })

  /** R1423: 특정 .bak 파일에서 복원 */
  ipcMain.handle('cc:file:restoreFromBak', async (_e, bakPath: string, scenePath: string) => {
    return restoreFromBakFile(bakPath, scenePath)
  })

  /** 씬 파일/디렉토리 감시 시작 */
  // R1478: 대형 씬 청크 스트리밍 파싱
  ipcMain.handle('cc:file:readSceneChunked', async (
    _e,
    scenePath: string,
    projectInfo: CCFileProjectInfo,
    chunkSize = 50,
    chunkOffset = 0
  ) => {
    try {
      const uuidMap = projectInfo.assetsDir ? await getCachedUUIDMap(projectInfo.assetsDir) : undefined
      return await parseCCSceneChunked(scenePath, projectInfo, chunkSize, chunkOffset, uuidMap)
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('cc:file:isLargeScene', async (_e, scenePath: string) => {
    try { return isLargeScene(scenePath) } catch { return false }
  })

  ipcMain.handle('cc:file:watch', async (_e, paths: string | string[]) => {
    await ccFileWatcher.watch(paths)
    return { watching: ccFileWatcher.watchedCount }
  })

  /** 감시 해제 */
  ipcMain.handle('cc:file:unwatch', async (_e, paths?: string | string[]) => {
    if (paths) {
      ccFileWatcher.unwatch(paths)
    } else {
      await ccFileWatcher.close()
    }
    return { watching: ccFileWatcher.watchedCount }
  })

  /** UUID 맵 빌드 (assetsDir 전수 스캔) */
  ipcMain.handle('cc:file:buildUUIDMap', async (_e, assetsDir: string) => {
    const map = await getCachedUUIDMap(assetsDir)
    // Map → plain object (IPC 전달 가능하도록)
    const obj: Record<string, { uuid: string; path: string; relPath: string; type: string }> = {}
    for (const [k, v] of map) obj[k] = v
    return obj
  })

  /** UUID → 텍스처 data URL 변환 (base64) */
  ipcMain.handle('cc:file:resolveTexture', async (_e, uuid: string, assetsDir: string) => {
    const map = await getCachedUUIDMap(assetsDir)
    const asset = map.get(uuid)
    if (!asset) return null
    if (asset.type !== 'texture' && asset.type !== 'sprite-atlas') return null
    try {
      // plist atlas의 경우 동일 이름의 .png 파일로 대체
      let imgPath = asset.path
      if (imgPath.endsWith('.plist')) {
        const pngPath = imgPath.slice(0, -5) + 'png'
        try { await readFile(pngPath); imgPath = pngPath } catch { /* plist 자체를 읽기 시도 */ }
      }
      const data = await readFile(imgPath)
      const ext = imgPath.split('.').pop()?.toLowerCase() ?? 'png'
      const mime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
      return `data:${mime[ext] ?? 'image/png'};base64,${data.toString('base64')}`
    } catch {
      return null
    }
  })

  /** UUID → 스프라이트 dataURL + spriteFrame meta border값 + atlas frame rect 반환 */
  ipcMain.handle('cc:file:resolveSprite', async (_e, uuid: string, assetsDir: string) => {
    const map = await getCachedUUIDMap(assetsDir)
    const asset = map.get(uuid)
    if (!asset) return null
    if (asset.type !== 'texture' && asset.type !== 'sprite-atlas') return null
    try {
      const originalPath = asset.path
      let imgPath = originalPath
      if (imgPath.endsWith('.plist')) {
        const pngPath = imgPath.slice(0, -5) + 'png'
        try { await readFile(pngPath); imgPath = pngPath } catch { /* ignore */ }
      }
      const data = await readFile(imgPath)
      const ext = imgPath.split('.').pop()?.toLowerCase() ?? 'png'
      const mime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
      const dataUrl = `data:${mime[ext] ?? 'image/png'};base64,${data.toString('base64')}`
      // spriteFrame meta에서 border(9-slice inset)값 + atlas frame rect 읽기
      let borderTop = 0, borderBottom = 0, borderLeft = 0, borderRight = 0
      let frame: { x: number; y: number; w: number; h: number; rotated: boolean } | null = null
      try {
        // plist atlas → plist.meta에서 읽어야 함 (png.meta 아님)
        const metaPath = originalPath + '.meta'
        const metaRaw = await readFile(metaPath, 'utf-8')
        const meta = JSON.parse(metaRaw) as {
          subMetas?: Record<string, {
            uuid?: string
            // CC 2.x: border/trim 직접
            borderTop?: number; borderBottom?: number; borderLeft?: number; borderRight?: number
            trimX?: number; trimY?: number; width?: number; height?: number
            rawWidth?: number; rawHeight?: number; rotated?: boolean
            rawTextureUuid?: string
            // CC 3.x: userData 내부
            userData?: {
              borderTop?: number; borderBottom?: number; borderLeft?: number; borderRight?: number
              trimX?: number; trimY?: number; width?: number; height?: number
              rawWidth?: number; rawHeight?: number; rotated?: boolean
              atlasUuid?: string; imageUuidOrDatabaseUri?: string
            }
          }>
        }
        const subMetas = meta.subMetas ?? {}
        for (const sub of Object.values(subMetas)) {
          if (sub.uuid === uuid) {
            // CC 3.x: userData 내부에 값이 있음 / CC 2.x: 직접
            const ud = sub.userData
            borderTop = ud?.borderTop ?? sub.borderTop ?? 0
            borderBottom = ud?.borderBottom ?? sub.borderBottom ?? 0
            borderLeft = ud?.borderLeft ?? sub.borderLeft ?? 0
            borderRight = ud?.borderRight ?? sub.borderRight ?? 0
            // atlas frame rect 추출 — trimX/trimY가 있고 rawTextureUuid 또는 atlasUuid가 있으면 atlas 소속
            const trimX = ud?.trimX ?? sub.trimX
            const trimY = ud?.trimY ?? sub.trimY
            const fw = ud?.width ?? sub.width
            const fh = ud?.height ?? sub.height
            const rawW = ud?.rawWidth ?? sub.rawWidth
            const rawH = ud?.rawHeight ?? sub.rawHeight
            const isAtlas = !!(ud?.atlasUuid ?? ud?.imageUuidOrDatabaseUri ?? sub.rawTextureUuid)
            const rotated = ud?.rotated ?? sub.rotated ?? false
            // frame이 전체 이미지와 다르면(atlas에서 크롭 필요) frame 정보 반환
            if (isAtlas && trimX != null && trimY != null && fw != null && fh != null) {
              const isFullImage = trimX === 0 && trimY === 0 && fw === rawW && fh === rawH
              if (!isFullImage) {
                frame = { x: trimX, y: trimY, w: fw, h: fh, rotated }
              }
            }
            break
          }
        }
      } catch { /* meta 없으면 border 0, frame null 유지 */ }
      return { dataUrl, borderTop, borderBottom, borderLeft, borderRight, frame }
    } catch {
      return null
    }
  })

  /** 씬 raw 배열에서 참조 UUID 목록 추출 */
  ipcMain.handle('cc:file:extractUUIDs', async (_e, raw: unknown[]) => {
    return extractReferencedUUIDs(raw)
  })

  /** R1410: UUID → 에셋 상세 정보 */
  ipcMain.handle('cc:file:getAssetInfo', async (_e, uuid: string, assetsDir: string) => {
    const { getAssetInfo } = await import('../cc/cc-asset-resolver')
    const map = await getCachedUUIDMap(assetsDir)
    return getAssetInfo(uuid, map)
  })

  /** R1410: 이미지 에셋 UUID 전체 목록 */
  ipcMain.handle('cc:file:getAllTextureUUIDs', async (_e, assetsDir: string) => {
    const { getAllTextureUUIDs } = await import('../cc/cc-asset-resolver')
    const map = await getCachedUUIDMap(assetsDir)
    return getAllTextureUUIDs(map)
  })

  /** R1438: 씬 로컬 HTTP 서버로 공유 (7332포트, 60초 후 종료) */
  ipcMain.handle('cc:file:serveScene', async (_e, sceneJson: string) => {
    // 크기 제한 (10MB)
    if (typeof sceneJson !== 'string' || sceneJson.length > 10 * 1024 * 1024) {
      return { success: false, error: 'payload too large or invalid' }
    }
    // 기존 서버 정리
    if (_sceneServer) { try { _sceneServer.close() } catch { /* ignore */ } }
    if (_sceneServerTimer) { clearTimeout(_sceneServerTimer); _sceneServerTimer = null }

    const port = 7332
    const server = http.createServer((req, res) => {
      if (req.url === '/scene.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(sceneJson)
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    return new Promise<{ success: boolean; url?: string; error?: string }>((resolve) => {
      server.on('error', (err) => {
        resolve({ success: false, error: String(err) })
      })
      server.listen(port, '127.0.0.1', () => {
        _sceneServer = server
        const url = `http://localhost:${port}/scene.json`
        // 60초 후 자동 종료
        _sceneServerTimer = setTimeout(() => {
          try { server.close() } catch { /* ignore */ }
          _sceneServer = null
          _sceneServerTimer = null
        }, 60000)
        resolve({ success: true, url })
      })
    })
  })

  /** 폰트 파일 (TTF/OTF/WOFF) → base64 data URL, .fnt(BMFont) → 시스템 폰트 폴백 */
  ipcMain.handle('cc:file:resolveFont', async (_e, uuid: string, assetsDir: string) => {
    const map = await getCachedUUIDMap(assetsDir)
    const asset = map.get(uuid)
    if (!asset) return null
    const ext = asset.path.split('.').pop()?.toLowerCase() ?? ''
    // BMFont(.fnt) → 시스템 폰트 폴백 (비트맵 폰트는 브라우저에서 렌더링 불가)
    if (ext === 'fnt') {
      const familyName = (asset.path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? uuid.slice(0, 8))
        .replace(/[^a-zA-Z0-9_-]/g, '_')
      return { dataUrl: '', familyName, fallback: true }
    }
    const fontExts = ['ttf', 'otf', 'woff', 'woff2', 'eot']
    if (!fontExts.includes(ext)) return null
    try {
      const data = await readFile(asset.path)
      const mimeMap: Record<string, string> = {
        ttf: 'font/truetype', otf: 'font/opentype',
        woff: 'font/woff', woff2: 'font/woff2', eot: 'application/vnd.ms-fontobject',
      }
      const mime = mimeMap[ext] ?? 'font/truetype'
      // fontFamily 이름은 파일명 (확장자 제거)
      const familyName = (asset.path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? uuid.slice(0, 8))
        .replace(/[^a-zA-Z0-9_-]/g, '_')
      return { dataUrl: `data:${mime};base64,${data.toString('base64')}`, familyName }
    } catch { return null }
  })
}
