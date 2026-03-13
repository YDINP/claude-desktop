import { ipcMain, dialog, BrowserWindow } from 'electron'
import { detectCCVersion } from '../cc/cc-version-detector'
import { parseCCScene } from '../cc/cc-file-parser'
import { saveCCScene, restoreFromBackup } from '../cc/cc-file-saver'
import { ccFileWatcher } from '../cc/cc-file-watcher'
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
      return parseCCScene(scenePath, projectInfo)
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

  /** 백업에서 씬 파일 복원 */
  ipcMain.handle('cc:file:restoreBackup', async (_e, scenePath: string) => {
    return restoreFromBackup(scenePath)
  })

  /** 씬 파일/디렉토리 감시 시작 */
  ipcMain.handle('cc:file:watch', async (_e, paths: string | string[]) => {
    ccFileWatcher.watch(paths)
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
}
