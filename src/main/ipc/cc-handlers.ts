import { ipcMain, BrowserWindow, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { execSync, spawn } from 'child_process'
import os from 'os'
import { getCCBridge } from '../cc/cc-bridge'
import {
  CC_CONNECT, CC_DISCONNECT, CC_STATUS,
  CC_GET_TREE, CC_GET_NODE, CC_SET_PROPERTY, CC_MOVE_NODE,
  CC_EVENT, CC_DETECT_PROJECT, CC_GET_PORT, CC_SET_PORT, CC_INSTALL_EXTENSION,
  CC_GET_CANVAS_SIZE, CC_GET_ASSETS,
} from '../../shared/ipc-schema'

let _ccHandlersRegistered = false
let _savedPort = 9090

export function registerCCHandlers(mainWindow: BrowserWindow) {
  if (_ccHandlersRegistered) return
  _ccHandlersRegistered = true

  ipcMain.handle(CC_CONNECT, async (_e, port = 9090) => {
    const bridge = getCCBridge(port)
    bridge.setOptions({
      onEvent: (event) => mainWindow.webContents.send(CC_EVENT, { ...event, _ccPort: port }),
      onStatusChange: (connected) => mainWindow.webContents.send('cc:statusChange', { connected, port }),
    })
    return bridge.connect(port)
  })

  ipcMain.handle(CC_DISCONNECT, async (_e, port = 9090) => {
    getCCBridge(port).disconnect()
    return true
  })

  ipcMain.handle(CC_STATUS, async (_e, port = 9090) => {
    const b = getCCBridge(port)
    return { connected: b.connected, port: b.port, version: b.version }
  })

  ipcMain.handle(CC_GET_TREE, async (_e, port = 9090) => {
    return getCCBridge(port).getTree()
  })

  ipcMain.handle(CC_GET_CANVAS_SIZE, async (_e, port = 9090) => {
    try {
      return await getCCBridge(port).getCanvasSize()
    } catch {
      return null
    }
  })

  ipcMain.handle(CC_GET_ASSETS, async (_e, port: number) => {
    const bridge = getCCBridge(port)
    return bridge.getAssets()
  })

  ipcMain.handle(CC_GET_NODE, async (_e, port = 9090, uuid: string) => {
    return getCCBridge(port).getNode(uuid)
  })

  ipcMain.handle(CC_SET_PROPERTY, async (_e, port = 9090, uuid: string, key: string, value: unknown) => {
    return getCCBridge(port).setProperty(uuid, key, value)
  })

  ipcMain.handle(CC_MOVE_NODE, async (_e, port = 9090, uuid: string, x: number, y: number) => {
    return getCCBridge(port).moveNode(uuid, x, y)
  })

  ipcMain.handle(CC_DETECT_PROJECT, async (_e, rootPath: string) => {
    if (!rootPath) return { detected: false }
    const hasAssets = fs.existsSync(path.join(rootPath, 'assets'))
    if (!hasAssets) return { detected: false }
    const has2x = fs.existsSync(path.join(rootPath, 'project.json'))
    if (has2x) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootPath, 'project.json'), 'utf-8'))
        const creatorVersion = pkg?.engine?.version as string | undefined
        return { detected: true, version: '2x', creatorVersion: creatorVersion || '2.x', port: 9090, name: pkg.name || path.basename(rootPath) }
      } catch {
        return { detected: true, version: '2x', creatorVersion: '2.x', port: 9090, name: path.basename(rootPath) }
      }
    }
    // CC 3.x: package.json creator.version 먼저 (정확한 버전)
    const pkgJsonPath = path.join(rootPath, 'package.json')
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
        const creatorVersion = pkg?.creator?.version as string | undefined
        if (creatorVersion && /^3\./.test(creatorVersion)) {
          return { detected: true, version: '3x', creatorVersion, port: 9091, name: pkg.name || path.basename(rootPath) }
        }
      } catch { /* ignore */ }
    }
    // CC 3.x: settings/project-setting.json fallback
    const has3xSettings = fs.existsSync(path.join(rootPath, 'settings', 'project-setting.json'))
    if (has3xSettings) {
      return { detected: true, version: '3x', creatorVersion: '3.x', port: 9091, name: path.basename(rootPath) }
    }
    return { detected: false }
  })

  ipcMain.handle('cc:openEditor', async (_e, projectPath: string, version: string, creatorVersion?: string) => {
    try {
      // cocos editor.json에서 설치된 에디터 목록 탐색
      const editorJsonPath = path.join(os.homedir(), '.cocos', 'profiles', 'editor.json')
      let exePath: string | null = null

      if (fs.existsSync(editorJsonPath)) {
        const editorData = JSON.parse(fs.readFileSync(editorJsonPath, 'utf-8'))
        const editors: Array<{ version: string; path: string }> = editorData?.editors ?? editorData ?? []
        const list = Array.isArray(editors) ? editors : Object.values(editors)

        if (creatorVersion) {
          // 정확한 버전 매칭
          const match = list.find((e: { version: string; path: string }) => e.version === creatorVersion)
          if (match) exePath = match.path
        }
        if (!exePath) {
          // major 버전 prefix 매칭 (3x → '3.', 2x → '2.')
          const prefix = version === '3x' ? '3.' : '2.'
          const match = list.find((e: { version: string; path: string }) => e.version?.startsWith(prefix))
          if (match) exePath = match.path
        }
      }

      // fallback: 표준 설치 경로
      if (!exePath) {
        const base = 'C:/ProgramData/cocos/editors/Creator'
        const ver = creatorVersion ?? (version === '3x' ? '3.8.6' : '2.4.13')
        exePath = path.join(base, ver, 'CocosCreator.exe')
      }

      if (!fs.existsSync(exePath)) {
        return { success: false, message: `CC 실행파일을 찾을 수 없습니다: ${exePath}` }
      }

      const args = version === '3x'
        ? ['--project', projectPath]
        : ['--path', projectPath]

      spawn(exePath, args, { detached: true, stdio: 'ignore' }).unref()
      return { success: true, message: `Cocos Creator ${creatorVersion ?? version} 실행 중...` }
    } catch (e) {
      return { success: false, message: String(e) }
    }
  })

  ipcMain.handle(CC_GET_PORT, async () => _savedPort)
  ipcMain.handle(CC_SET_PORT, async (_e, port: number) => { _savedPort = port; return true })

  ipcMain.handle('cc:installExtension', async (_e, projectPath: string, version: string) => {
    try {
      const extName = version === '3x' ? 'cc-ws-extension-3x' : 'cc-ws-extension-2x'
      const extFolder = version === '3x' ? 'extensions' : 'packages'
      // dev: project root / prod: resources/app 모두 탐색
      const candidates = [
        path.join(app.getAppPath(), 'extensions', extName),
        path.join(app.getAppPath(), '..', '..', 'extensions', extName),
        path.join(__dirname, '..', '..', 'extensions', extName),
      ]
      const srcPath = candidates.find(p => fs.existsSync(p)) ?? candidates[0]
      const destPath = path.join(projectPath, extFolder, extName)

      if (!fs.existsSync(srcPath)) {
        return { success: false, message: `Extension 소스를 찾을 수 없습니다: ${srcPath}` }
      }

      // Copy extension folder
      fs.cpSync(srcPath, destPath, { recursive: true, force: true })

      // Run npm install
      execSync('npm install', { cwd: destPath, timeout: 60000, stdio: 'ignore' })

      return { success: true, message: `${extName} 설치 완료! CC를 재시작해주세요.` }
    } catch (e) {
      return { success: false, message: String(e) }
    }
  })
}
