import type { BrowserWindow } from 'electron'

const IPC_TERMINAL_DATA = 'terminal:data'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPty = any

export class PtyManager {
  private win: BrowserWindow
  private instances = new Map<string, { process: AnyPty; id: string }>()
  available = false

  constructor(win: BrowserWindow) {
    this.win = win
    // Test if a pty lib is usable at runtime
    try {
      const pty = this._loadPty()
      if (pty) {
        this.available = true
        console.log('[PtyManager] Terminal available')
      }
    } catch {
      console.warn('[PtyManager] Terminal unavailable — native binary not found')
    }
  }

  private _loadPty(): AnyPty {
    try { return require('node-pty-prebuilt-multiarch') } catch { /* */ }
    try { return require('node-pty') } catch { /* */ }
    return null
  }

  create(id: string, cwd: string, cols = 80, rows = 24) {
    const pty = this._loadPty()
    if (!pty) return

    try {
      const shell = process.platform === 'win32' ? 'cmd.exe' : (process.env.SHELL || 'bash')
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols,
        rows,
        cwd,
        env: process.env as Record<string, string>
      })

      ptyProcess.onData((data: string) => {
        if (!this.win.isDestroyed()) {
          this.win.webContents.send(IPC_TERMINAL_DATA, { id, data })
        }
      })

      ptyProcess.onExit(() => this.instances.delete(id))
      this.instances.set(id, { process: ptyProcess, id })
    } catch (err) {
      console.warn('[PtyManager] spawn failed:', err)
      this.available = false
    }
  }

  write(id: string, data: string) {
    try { this.instances.get(id)?.process.write(data) } catch { /* */ }
  }

  resize(id: string, cols: number, rows: number) {
    try { this.instances.get(id)?.process.resize(cols, rows) } catch { /* */ }
  }

  close(id: string) {
    const inst = this.instances.get(id)
    if (inst) {
      try { inst.process.kill() } catch { /* */ }
      this.instances.delete(id)
    }
  }

  closeAll() {
    for (const [id] of this.instances) this.close(id)
  }
}
