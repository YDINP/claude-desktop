import { ipcMain, dialog, BrowserWindow } from 'electron'
import http from 'http'
import { readFile } from 'fs/promises'
import { detectCCVersion } from '../cc/cc-version-detector'
import { parseCCScene, parseCCSceneChunked, isLargeScene } from '../cc/cc-file-parser'
import { saveCCScene, restoreFromBackup, listBakFiles, deleteAllBakFiles, restoreFromBakFile, recordSceneMtime, forceOverwriteScene } from '../cc/cc-file-saver'
import { ccFileWatcher } from '../cc/cc-file-watcher'
import { buildUUIDMap, extractReferencedUUIDs, resolveTextureUrl } from '../cc/cc-asset-resolver'
import {
  CC_FILE_DETECT,
  CC_FILE_OPEN_PROJECT,
  CC_FILE_LIST_SCENES,
  CC_FILE_READ_SCENE,
  CC_FILE_SAVE_SCENE,
} from '../../shared/ipc-schema'
import type { CCFileProjectInfo, CCSceneFile, CCSceneNode } from '../../shared/ipc-schema'

let _registered = false
let _watchUnsubscribe: (() => void) | null = null
let _partialUpdateUnsubscribe: (() => void) | null = null
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
      const result = parseCCScene(scenePath, projectInfo)
      // R1437: 로드 시 mtime 기록
      recordSceneMtime(scenePath)
      return result
    } catch (e) {
      return { error: String(e) }
    }
  })

  /** 수정된 씬 트리 → 파일 저장 (temp→rename 원자적, .bak 백업) */
  ipcMain.handle(CC_FILE_SAVE_SCENE, async (
    _e,
    sceneFile: CCSceneFile,
    modifiedRoot: CCSceneNode
  ) => {
    return saveCCScene(sceneFile, modifiedRoot)
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
      return parseCCSceneChunked(scenePath, projectInfo, chunkSize, chunkOffset)
    } catch (e) {
      return { error: String(e) }
    }
  })

  ipcMain.handle('cc:file:isLargeScene', async (_e, scenePath: string) => {
    return isLargeScene(scenePath)
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
    const map = buildUUIDMap(assetsDir)
    // Map → plain object (IPC 전달 가능하도록)
    const obj: Record<string, { uuid: string; path: string; relPath: string; type: string }> = {}
    for (const [k, v] of map) obj[k] = v
    return obj
  })

  /** UUID → 텍스처 data URL 변환 (base64) */
  ipcMain.handle('cc:file:resolveTexture', async (_e, uuid: string, assetsDir: string) => {
    const map = buildUUIDMap(assetsDir)
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

  /** 씬 raw 배열에서 참조 UUID 목록 추출 */
  ipcMain.handle('cc:file:extractUUIDs', async (_e, raw: unknown[]) => {
    return extractReferencedUUIDs(raw)
  })

  /** R1410: UUID → 에셋 상세 정보 */
  ipcMain.handle('cc:file:getAssetInfo', async (_e, uuid: string, assetsDir: string) => {
    const { getAssetInfo } = await import('../cc/cc-asset-resolver')
    const map = buildUUIDMap(assetsDir)
    return getAssetInfo(uuid, map)
  })

  /** R1410: 이미지 에셋 UUID 전체 목록 */
  ipcMain.handle('cc:file:getAllTextureUUIDs', async (_e, assetsDir: string) => {
    const { getAllTextureUUIDs } = await import('../cc/cc-asset-resolver')
    const map = buildUUIDMap(assetsDir)
    return getAllTextureUUIDs(map)
  })

  /** R1438: 씬 로컬 HTTP 서버로 공유 (7332포트, 60초 후 종료) */
  ipcMain.handle('cc:file:serveScene', async (_e, sceneJson: string) => {
    // 기존 서버 정리
    if (_sceneServer) { try { _sceneServer.close() } catch { /* ignore */ } }
    if (_sceneServerTimer) { clearTimeout(_sceneServerTimer); _sceneServerTimer = null }

    const port = 7332
    const server = http.createServer((req, res) => {
      if (req.url === '/scene.json') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
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
}
