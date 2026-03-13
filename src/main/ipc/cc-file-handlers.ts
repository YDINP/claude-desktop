import { ipcMain, dialog } from 'electron'
import { detectCCVersion } from '../cc/cc-version-detector'
import { parseCCScene } from '../cc/cc-file-parser'
import {
  CC_FILE_DETECT,
  CC_FILE_OPEN_PROJECT,
  CC_FILE_LIST_SCENES,
  CC_FILE_READ_SCENE,
} from '../../shared/ipc-schema'
import type { CCFileProjectInfo } from '../../shared/ipc-schema'

let _registered = false

export function registerCCFileHandlers() {
  if (_registered) return
  _registered = true

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
}
