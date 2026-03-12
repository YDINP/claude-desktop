import { ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { ccBridge } from '../cc/cc-bridge'
import {
  CC_CONNECT, CC_DISCONNECT, CC_STATUS,
  CC_GET_TREE, CC_GET_NODE, CC_SET_PROPERTY, CC_MOVE_NODE,
  CC_EVENT, CC_DETECT_PROJECT, CC_GET_PORT, CC_SET_PORT,
} from '../../shared/ipc-schema'

let _ccHandlersRegistered = false
let _savedPort = 9090

export function registerCCHandlers(mainWindow: BrowserWindow) {
  if (_ccHandlersRegistered) return
  _ccHandlersRegistered = true

  ccBridge.setOptions({
    onEvent: (event) => mainWindow.webContents.send(CC_EVENT, event),
    onStatusChange: (connected) => mainWindow.webContents.send('cc:statusChange', { connected }),
  })

  ipcMain.handle(CC_CONNECT, async (_e, port?: number) => {
    return ccBridge.connect(port ?? 9090)
  })

  ipcMain.handle(CC_DISCONNECT, async () => {
    ccBridge.disconnect()
    return true
  })

  ipcMain.handle(CC_STATUS, async () => ({
    connected: ccBridge.connected,
    port: ccBridge.port,
    version: ccBridge.version,
  }))

  ipcMain.handle(CC_GET_TREE, async () => {
    return ccBridge.getTree()
  })

  ipcMain.handle(CC_GET_NODE, async (_e, uuid: string) => {
    return ccBridge.getNode(uuid)
  })

  ipcMain.handle(CC_SET_PROPERTY, async (_e, uuid: string, key: string, value: unknown) => {
    return ccBridge.setProperty(uuid, key, value)
  })

  ipcMain.handle(CC_MOVE_NODE, async (_e, uuid: string, x: number, y: number) => {
    return ccBridge.moveNode(uuid, x, y)
  })

  ipcMain.handle(CC_DETECT_PROJECT, async (_e, rootPath: string) => {
    if (!rootPath) return { detected: false }
    const hasAssets = fs.existsSync(path.join(rootPath, 'assets'))
    if (!hasAssets) return { detected: false }
    const has2x = fs.existsSync(path.join(rootPath, 'project.json'))
    if (has2x) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootPath, 'project.json'), 'utf-8'))
        return { detected: true, version: '2x', port: 9090, name: pkg.name || path.basename(rootPath) }
      } catch {
        return { detected: true, version: '2x', port: 9090, name: path.basename(rootPath) }
      }
    }
    const has3x = fs.existsSync(path.join(rootPath, 'settings', 'project-setting.json'))
    if (has3x) {
      return { detected: true, version: '3x', port: 9091, name: path.basename(rootPath) }
    }
    return { detected: false }
  })

  ipcMain.handle(CC_GET_PORT, async () => _savedPort)
  ipcMain.handle(CC_SET_PORT, async (_e, port: number) => { _savedPort = port; return true })
}
