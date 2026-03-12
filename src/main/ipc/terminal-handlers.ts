import { ipcMain } from 'electron'
import { PtyManager } from '../terminal/pty-manager'

export function registerTerminalHandlers(ptyManager: PtyManager) {
  ipcMain.on('terminal:create', (_, { id, cwd }: { id: string; cwd: string }) => {
    ptyManager.create(id, cwd)
  })

  ipcMain.on('terminal:data', (_, { id, data }: { id: string; data: string }) => {
    ptyManager.write(id, data)
  })

  ipcMain.on('terminal:resize', (_, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    ptyManager.resize(id, cols, rows)
  })

  ipcMain.on('terminal:close', (_, { id }: { id: string }) => {
    ptyManager.close(id)
  })
}
