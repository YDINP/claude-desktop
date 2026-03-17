/**
 * IPC Bridge — window.api ↔ Kernel 연결
 * window.api.onXxx 이벤트 → eventBus.emit()
 * commandBus 핸들러 → window.api.xxx() 호출
 *
 * Phase A: 이벤트 브릿지만 설치.
 * 도메인 어댑터(chat/cocos/...)는 Phase B/C에서 추가.
 */
import { eventBus } from './eventBus'
import { commandBus } from './commandBus'
import type { StreamEvent, PermissionRequest, CCEvent, CCStatus } from '../../../shared/ipc-schema'

let initialized = false
const cleanups: (() => void)[] = []

export function initIpcBridge(): void {
  if (initialized) return
  initialized = true

  const api = window.api
  if (!api) {
    console.warn('[IpcBridge] window.api unavailable — bridge skipped')
    return
  }

  // ── Main→Renderer 이벤트 → EventBus ──────────────────────────────────────

  // Claude streaming
  if (api.onClaudeMessage) {
    const unsub = api.onClaudeMessage((event: unknown) => {
      eventBus.emit({ type: 'claude:message', payload: event as StreamEvent })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // Claude permission
  if (api.onClaudePermission) {
    const unsub = api.onClaudePermission((req: unknown) => {
      eventBus.emit({ type: 'claude:permission', payload: req as PermissionRequest })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // CC live events
  if (api.onCCEvent) {
    const unsub = api.onCCEvent((event: unknown) => {
      eventBus.emit({ type: 'cc:event', payload: event as CCEvent })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  if (api.onCCStatusChange) {
    const unsub = api.onCCStatusChange((status: unknown) => {
      eventBus.emit({ type: 'cc:statusChange', payload: status as CCStatus })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // CC file watcher
  if (api.onCCFileChanged) {
    const unsub = api.onCCFileChanged((path: unknown) => {
      eventBus.emit({ type: 'cc:fileChanged', payload: { path: path as string } })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // Terminal
  if (api.onTerminalData) {
    const unsub = api.onTerminalData((data: unknown) => {
      const d = data as { id: string; data: string }
      eventBus.emit({ type: 'terminal:data', payload: d })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // Filesystem watcher
  if (api.onDirChanged) {
    const unsub = api.onDirChanged((info: unknown) => {
      const i = info as { path: string; type: string }
      eventBus.emit({ type: 'fs:change', payload: i })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // App-level shortcuts
  if (api.onCloseTab) {
    const unsub = api.onCloseTab(() => {
      eventBus.emit({ type: 'app:closeTab', payload: {} })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  if (api.onFontSizeShortcut) {
    const unsub = api.onFontSizeShortcut((delta: unknown) => {
      eventBus.emit({ type: 'app:fontSizeShortcut', payload: { delta: delta as number } })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  if (api.onNativeThemeChanged) {
    const unsub = api.onNativeThemeChanged((isDark: unknown) => {
      eventBus.emit({ type: 'app:themeChanged', payload: { isDark: isDark as boolean } })
    })
    if (typeof unsub === 'function') cleanups.push(unsub)
  }

  // ── CommandBus → window.api 핸들러 ───────────────────────────────────────

  // chat
  commandBus.register('chat:interrupt', ({ sessionId }) =>
    api.claudeInterrupt?.(sessionId)
  )
  commandBus.register('chat:close', ({ sessionId }) =>
    api.claudeClose?.(sessionId)
  )
  commandBus.register('chat:permissionReply', ({ requestId, allow, sessionId }) =>
    api.claudePermissionReply?.({ requestId, allow, sessionId })
  )

  // terminal
  commandBus.register('terminal:create', ({ id, cwd }) =>
    api.terminalCreate?.({ id, cwd })
  )
  commandBus.register('terminal:write', ({ id, data }) =>
    api.terminalWrite?.({ id, data })
  )
  commandBus.register('terminal:resize', ({ id, cols, rows }) =>
    api.terminalResize?.({ id, cols, rows })
  )
  commandBus.register('terminal:close', ({ id }) =>
    api.terminalClose?.(id)
  )

  // filesystem
  commandBus.register('fs:readFile', ({ path }) =>
    api.readFile?.(path)
  )
  commandBus.register('fs:readDir', ({ path }) =>
    api.readDir?.(path)
  )
  commandBus.register('fs:saveFile', ({ path, content }) =>
    api.saveFile?.({ path, content })
  )
  commandBus.register('fs:watchDir', ({ path }) =>
    api.watchDir?.(path)
  )
  commandBus.register('fs:unwatchDir', ({ path }) =>
    api.unwatchDir?.(path)
  )

  // session
  commandBus.register('session:load', ({ sessionId }) =>
    api.sessionLoad?.(sessionId)
  )
  commandBus.register('session:delete', ({ sessionId }) =>
    api.sessionDelete?.(sessionId)
  )

  // cocos file
  commandBus.register('cocos:saveScene', ({ root, sceneFile }) =>
    api.ccFileSaveScene?.({ root, sceneFile })
  )
}

export function destroyIpcBridge(): void {
  cleanups.forEach(fn => fn())
  cleanups.length = 0
  initialized = false
}
