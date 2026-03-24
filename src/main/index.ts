import { app, BrowserWindow, shell, protocol, globalShortcut, Tray, nativeImage, Menu, nativeTheme, ipcMain } from 'electron'
import { join, resolve } from 'path'
import { readFile } from 'fs/promises'
import { registerAllHandlers } from './ipc/router'
import { AppConfig } from './store/app-config'

const isDev = !app.isPackaged

// Extend app type for isQuitting flag
declare module 'electron' {
  interface App { isQuitting: boolean }
}
app.isQuitting = false

const LOCAL_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  ico: 'image/x-icon', bmp: 'image/bmp',
}

// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: 'local', privileges: { secure: true, standard: true, bypassCSP: true, supportFetchAPI: true } }
])

function createWindow(): BrowserWindow {
  const config = AppConfig.getInstance()
  const bounds = config.getWindowBounds()
  const preloadPath = join(app.getAppPath(), 'out/preload/index.js')
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 600,
    show: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#d4d4d4',
      height: 32
    },
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // Minimize to tray on close
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  let boundsDebounce: ReturnType<typeof setTimeout> | null = null
  const saveBounds = () => {
    if (boundsDebounce) clearTimeout(boundsDebounce)
    boundsDebounce = setTimeout(() => config.setWindowBounds(win.getBounds()), 500)
  }
  win.on('resize', saveBounds)
  win.on('move', saveBounds)

  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key === 'w') {
      event.preventDefault()
      win.webContents.send('shortcut:close-tab')
    }
    if (input.control && (input.key === 'r' || input.key === 'R')) {
      event.preventDefault()
    }
    if (input.key === 'F12' && isDev) {
      win.webContents.toggleDevTools()
    }
    if (input.control && (input.key === '=' || input.key === '+')) {
      event.preventDefault()
      win.webContents.send('shortcut:font-size', { delta: 1 })
    }
    if (input.control && input.key === '-') {
      event.preventDefault()
      win.webContents.send('shortcut:font-size', { delta: -1 })
    }
    if (input.control && input.key === '0') {
      event.preventDefault()
      win.webContents.send('shortcut:font-size', { delta: 0, reset: true })
    }
  })

  // 복사/붙여넣기 context-menu: 텍스트 편집 영역 우클릭 시 기본 메뉴 제공
  win.webContents.on('context-menu', (_e, params) => {
    const { editFlags, selectionText, isEditable } = params
    if (!isEditable && !selectionText) return

    const items: Electron.MenuItemConstructorOptions[] = []
    if (editFlags.canUndo) items.push({ role: 'undo' })
    if (editFlags.canRedo) items.push({ role: 'redo' })
    if (items.length) items.push({ type: 'separator' })
    if (editFlags.canCut) items.push({ role: 'cut' })
    if (editFlags.canCopy || selectionText) items.push({ role: 'copy' })
    if (editFlags.canPaste) items.push({ role: 'paste' })
    if (editFlags.canSelectAll) items.push({ type: 'separator' }, { role: 'selectAll' })

    if (items.length) Menu.buildFromTemplate(items).popup({ window: win })
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && rendererUrl) {
    win.loadURL(rendererUrl)
  } else if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

let tray: Tray | null = null
let ccEditorWin: BrowserWindow | null = null

app.whenReady().then(() => {
  protocol.handle('local', async (request) => {
    try {
      const url = new URL(request.url)
      const filePath = url.searchParams.get('path') ?? ''
      if (!filePath) return new Response(null, { status: 400 })
      // Prevent path traversal: decode and resolve, then check against allowed base dirs
      let decoded: string
      try { decoded = decodeURIComponent(filePath) } catch { decoded = filePath }
      const resolvedPath = resolve(decoded)
      const allowedBases = [app.getPath('userData'), app.getPath('home')]
      const isAllowed = allowedBases.some(base => resolvedPath.startsWith(resolve(base)))
      if (!isAllowed) {
        return new Response(null, { status: 403 })
      }
      const data = await readFile(filePath)
      const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
      return new Response(data, {
        status: 200,
        headers: { 'Content-Type': LOCAL_MIME[ext] ?? 'application/octet-stream' }
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  const win = createWindow()
  registerAllHandlers(win)

  // New window IPC
  ipcMain.handle('app:newWindow', () => {
    createWindow()
  })

  // CC Editor detached window
  ipcMain.handle('cc:open-window', async () => {
    if (ccEditorWin && !ccEditorWin.isDestroyed()) {
      ccEditorWin.focus()
      return
    }
    const preloadPath = join(app.getAppPath(), 'out/preload/index.js')
    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    ccEditorWin = new BrowserWindow({
      width: 1200,
      height: 800,
      title: 'CC Editor',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    ccEditorWin.on('closed', () => { ccEditorWin = null })
    if (isDev && rendererUrl) {
      ccEditorWin.loadURL(rendererUrl + '#cc-editor')
    } else if (isDev) {
      ccEditorWin.loadURL('http://localhost:5173#cc-editor')
    } else {
      ccEditorWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'cc-editor' })
    }
  })

  // Terminal theme IPC
  ipcMain.handle('app:getTerminalTheme', () => AppConfig.getInstance().getTerminalTheme())
  ipcMain.handle('app:setTerminalTheme', (_, theme: string) => AppConfig.getInstance().setTerminalTheme(theme))

  // System prompt profiles IPC
  ipcMain.handle('app:getSystemPromptProfiles', () => AppConfig.getInstance().getSystemPromptProfiles())
  ipcMain.handle('app:saveSystemPromptProfile', (_, profile) => AppConfig.getInstance().saveSystemPromptProfile(profile))
  ipcMain.handle('app:deleteSystemPromptProfile', (_, id: string) => AppConfig.getInstance().deleteSystemPromptProfile(id))

  // Tasks IPC
  ipcMain.handle('app:getTasks', () => AppConfig.getInstance().getTasks())
  ipcMain.handle('app:saveTasks', (_, tasks) => AppConfig.getInstance().saveTasks(tasks))

  // Notification settings IPC
  ipcMain.handle('app:getNotificationSettings', () => AppConfig.getInstance().getNotificationSettings())
  ipcMain.handle('app:setNotificationSettings', (_, s) => AppConfig.getInstance().setNotificationSettings(s))

  // Memory IPC
  ipcMain.handle('app:memoryUsage', () => {
    const mem = process.memoryUsage()
    return { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal }
  })
  // R2314: ISSUE-006 — 반환값 저장 후 will-quit 시 clearInterval
  const memTimer = setInterval(() => {
    if (win && !win.isDestroyed()) {
      const mem = process.memoryUsage()
      win.webContents.send('app:memoryUpdate', { rss: mem.rss, heapUsed: mem.heapUsed })
    }
  }, 3000)
  app.on('will-quit', () => clearInterval(memTimer))

  // nativeTheme IPC
  ipcMain.handle('native-theme:get', () => ({ isDark: nativeTheme.shouldUseDarkColors }))
  nativeTheme.on('updated', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('native-theme:changed', { isDark: nativeTheme.shouldUseDarkColors })
    }
  })

  // Global hotkey: Ctrl+Shift+Space → show/focus app
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  globalShortcut.register('CommandOrControl+Shift+N', () => {
    createWindow()
  })

  // System tray
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADhSURBVDiNpZMxCsJAEEX/JBsXsfQCRtCTeIgUXsTSM1ioxcJewMJCsBMEBUVRBBsNBMHlZ3ezJtuQEHwwMLNv5s3MLjuSJDEiJ0k6S5JqSbEJEqCSBhG5ANgBV+AErIDFnJuBBxBEKIDlGW7ACjgB9e8BSUQ0mwTAGugBL+CQZE0bkDzJJg0kzRoGOEnSNMD5UVKrWZKkWZIkdZJknSRJuiVJuiQAkiRN0iRN0iRJugBQlb9hmqYpSaqqKqWUqiqqqqqUVFVVqqqqVFXVoKqqgqiqqiqqr7+WuSmHXz3wAAAAASUVORK5CYII='
  )
  tray = new Tray(icon)
  tray.setToolTip('Claude Desktop')
  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Claude Desktop 열기',
      click: () => { win.show(); win.focus() }
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => { app.isQuitting = true; app.quit() }
    }
  ])
  tray.setContextMenu(trayMenu)
  tray.on('click', () => {
    if (win.isDestroyed()) return
    if (win.isVisible() && win.isFocused()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })
  tray.on('double-click', () => {
    if (win.isDestroyed()) return
    win.show()
    win.focus()
  })
})

app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
