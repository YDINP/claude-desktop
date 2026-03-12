import { ipcMain, BrowserWindow } from 'electron'
import { ccBridge } from '../cc/cc-bridge'
import {
  CC_CONNECT, CC_DISCONNECT, CC_STATUS,
  CC_GET_TREE, CC_GET_NODE, CC_SET_PROPERTY, CC_MOVE_NODE,
  CC_EVENT,
} from '../../shared/ipc-schema'

export function registerCCHandlers(mainWindow: BrowserWindow) {
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
    port: 9090,
    version: '2x',
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
}
